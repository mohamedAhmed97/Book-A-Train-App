import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpcVanilla } from "@/lib/trpcVanilla";
import { useVitalsStore } from "@/stores/vitalsStore";
import {
  currentProvider,
  getAvailability,
  getGrantedRecordTypes,
  isSupported,
  readDailyRollup,
  readVitals,
} from "@/lib/vitalsSource";
import type { VitalSample } from "@/lib/vitalsTypes";
import {
  activeMetrics as bleActiveMetrics,
  drainSamples as drainBleSamples,
  getBleStatus,
  isConnected as bleIsConnected,
  reconnectRememberedSensor,
} from "@/lib/bleHeartRate";

/**
 * Pulls watch samples off the platform health store on a timer and ships them
 * to the API so the coach's dashboard can render them near-live. The store is
 * Health Connect on Android and HealthKit on iOS — `vitalsSource` picks.
 *
 * Neither store is a stream: samples only appear once the watch's own companion
 * app (Samsung Health, Fitbit, Garmin, …) flushes them to the phone. Polling is
 * therefore the correct shape here, and end-to-end latency is bounded by that
 * vendor sync, not by this interval.
 */

/** How often to read Health Connect while a session is recording. */
const POLL_INTERVAL_MS = 15_000;

/**
 * Re-read a window slightly older than the last cursor. Vendor apps backfill
 * samples with timestamps earlier than their write time, so a strict
 * "since last cursor" read would silently skip them. Server-side dedupe on
 * (athlete, metric, instant) makes the overlap free.
 */
const OVERLAP_MS = 90_000;

/** Cap a single upload so a long offline stretch doesn't exceed the API limit. */
const MAX_UPLOAD_BATCH = 500;

interface StreamerSession {
  bookingId: string;
  deviceName?: string;
}

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let active: StreamerSession | null = null;
let cursor: Date | null = null;
let inFlight = false;
/**
 * Samples read but not yet accepted by the server, retried on the next tick.
 * Kept per channel because `ingest` stamps one provider per batch, so the two
 * sources can't share a queue.
 */
let backlogPlatform: VitalSample[] = [];
let backlogBle: VitalSample[] = [];

function dedupeKey(s: VitalSample) {
  return `${s.metric}|${s.recordedAt}`;
}

/**
 * Begin streaming for a booking. Returns false when the watch isn't usable, so
 * the caller can leave the session running as a plain timer.
 */
export async function startVitalsStream(session: StreamerSession): Promise<boolean> {
  const store = useVitalsStore.getState();
  store.setState("starting");

  // Bring a previously paired strap back up in parallel with interrogating the
  // health store — the two channels are independent.
  const blePromise = reconnectRememberedSensor().catch(() => false);

  let platformReason: string | null = null;
  let platformOk = false;

  if (!isSupported()) {
    platformReason = "unsupported";
  } else {
    const availability = await getAvailability();
    if (availability !== "available") {
      platformReason = availability;
    } else if ((await getGrantedRecordTypes()).length === 0) {
      platformReason = "no_permissions";
    } else {
      platformOk = true;
    }
  }

  const bleOk = await blePromise;

  // A paired strap is sufficient on its own. Health Connect being unavailable
  // used to abort the whole session stream; with a direct sensor link that
  // would throw away the better of the two data sources.
  if (!platformOk && !bleOk) {
    store.setState(platformReason === "unsupported" ? "idle" : "error", platformReason);
    return false;
  }

  stopTimers();
  active = session;
  // Look slightly into the past on start so a reading taken during warm-up
  // isn't lost.
  cursor = new Date(Date.now() - OVERLAP_MS);
  backlogPlatform = [];
  backlogBle = [];
  store.setState("streaming");

  timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  // Poll immediately on foreground — Android throttles timers in the
  // background, so returning to the app should catch up right away.
  appStateSub = AppState.addEventListener("change", (next: AppStateStatus) => {
    if (next === "active") void tick();
  });

  void tick();
  return true;
}

/** Flush any remaining samples and stop polling. Safe to call when inactive. */
export async function stopVitalsStream(): Promise<void> {
  if (!active) {
    stopTimers();
    return;
  }
  // One last read to capture samples written during the final interval.
  await tick();
  stopTimers();
  active = null;
  cursor = null;
  backlogPlatform = [];
  backlogBle = [];
  useVitalsStore.getState().setState("idle");
}

function stopTimers() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

/** Oldest-first, de-duplicated on (metric, instant). */
function mergePending(previous: VitalSample[], fresh: VitalSample[]): VitalSample[] {
  const merged = new Map<string, VitalSample>();
  for (const s of [...previous, ...fresh]) merged.set(dedupeKey(s), s);
  return [...merged.values()].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

interface FlushResult {
  ok: boolean;
  /** What remains queued for the next tick. */
  remaining: VitalSample[];
}

/** Upload one channel's batch. Never throws; failure is reported for retry. */
async function flush(
  bookingId: string,
  provider: string,
  deviceName: string | undefined,
  pending: VitalSample[],
): Promise<FlushResult> {
  if (pending.length === 0) return { ok: true, remaining: [] };

  const batch = pending.slice(0, MAX_UPLOAD_BATCH);
  const remainder = pending.slice(MAX_UPLOAD_BATCH);

  try {
    await trpcVanilla.vitals.ingest.mutate({
      bookingId,
      provider,
      deviceName,
      samples: batch.map((s) => ({
        metric: s.metric,
        value: s.value,
        unit: s.unit,
        recordedAt: s.recordedAt,
      })),
    });
    // Anything over the batch cap stays queued for the next tick.
    return { ok: true, remaining: remainder };
  } catch {
    // Offline or server error — keep the samples and retry next tick rather
    // than dropping data the watch may have already discarded.
    return { ok: false, remaining: pending.slice(-MAX_UPLOAD_BATCH * 4) };
  }
}

async function tick(): Promise<void> {
  if (!active || inFlight) return;
  inFlight = true;

  const store = useVitalsStore.getState();
  const bookingId = active.bookingId;

  try {
    const now = new Date();
    const from = cursor ?? new Date(now.getTime() - OVERLAP_MS);

    // Drain the strap first — already buffered in memory, no I/O.
    const bleFresh = drainBleSamples();

    // Precedence: while the strap is delivering a metric, drop the health
    // store's copy of it. Both channels carry heart rate during a session, and
    // their samples land on different timestamps, so they would not dedupe —
    // the coach would see two interleaved series for one athlete.
    const owned = new Set(bleActiveMetrics());
    const platformRead = await readVitals(new Date(from.getTime() - OVERLAP_MS), now);
    const platformFresh =
      owned.size === 0 ? platformRead : platformRead.filter((s) => !owned.has(s.metric));

    // Advance the cursor even when nothing came back, so the read window
    // doesn't grow without bound during a quiet stretch.
    cursor = now;

    const fresh = [...bleFresh, ...platformFresh];
    if (fresh.length > 0) store.ingestLocal(fresh);

    const platformPending = mergePending(backlogPlatform, platformFresh);
    const blePending = mergePending(backlogBle, bleFresh);
    const totalPending = platformPending.length + blePending.length;

    if (totalPending === 0) {
      // Linked and polling, but neither channel has produced anything.
      // Re-read state here: `store` was captured before ingestLocal ran.
      const current = useVitalsStore.getState();
      if (current.state === "streaming" && current.lastUploadAt === null) {
        current.setState("no_data");
      }
      return;
    }

    store.setPendingCount(totalPending);

    const [platformResult, bleResult] = await Promise.all([
      flush(bookingId, currentProvider(), active.deviceName, platformPending),
      flush(bookingId, "BLE", getBleStatus().device?.name, blePending),
    ]);

    backlogPlatform = platformResult.remaining;
    backlogBle = bleResult.remaining;
    const remaining = backlogPlatform.length + backlogBle.length;
    store.setPendingCount(remaining);

    if (platformResult.ok && bleResult.ok) {
      store.markUploaded();
      store.setState("streaming");
    } else {
      // markUploaded() would clear pendingCount, so it's deliberately skipped
      // on a partial failure — the queued count is what the athlete needs.
      store.setState("error", "upload_failed");
    }
  } catch {
    store.setState("error", "read_failed");
  } finally {
    inFlight = false;
  }
}

/**
 * Push today's recovery numbers (resting HR, HRV, sleep, …). Independent of any
 * session — call on app foreground, not during a workout.
 */
export async function syncDailyVitals(day = new Date()): Promise<boolean> {
  if (!isSupported()) return false;
  if ((await getAvailability()) !== "available") return false;

  try {
    const rollup = await readDailyRollup(day);
    if (!rollup || rollup.metrics.length === 0) return false;
    await trpcVanilla.vitals.upsertDaily.mutate({
      date: rollup.date,
      metrics: rollup.metrics,
    });
    return true;
  } catch {
    return false;
  }
}

export function isStreaming(): boolean {
  return active !== null;
}

// ── Daily sync ─────────────────────────────────────────────────────────────
//
// Recovery numbers don't need session-grade latency — they change a handful of
// times a day, and the vendor app decides when they land on the phone. So this
// runs opportunistically on foreground rather than on a timer.

/** Floor on how often a foreground event may trigger a rollup read. */
const DAILY_SYNC_MIN_INTERVAL_MS = 30 * 60_000;

/** Persisted so relaunching the app repeatedly doesn't re-read every time. */
const DAILY_SYNC_STORAGE_KEY = "bat_daily_vitals_synced_at";

/** `undefined` = not yet read back from storage, `null` = never synced. */
let lastDailySyncAt: number | null | undefined;
let dailySub: { remove: () => void } | null = null;

async function loadLastDailySync(): Promise<number | null> {
  if (lastDailySyncAt !== undefined) return lastDailySyncAt;
  try {
    const raw = await AsyncStorage.getItem(DAILY_SYNC_STORAGE_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    lastDailySyncAt = Number.isFinite(parsed) ? parsed : null;
  } catch {
    lastDailySyncAt = null;
  }
  return lastDailySyncAt;
}

async function rememberDailySync(at: number): Promise<void> {
  lastDailySyncAt = at;
  try {
    await AsyncStorage.setItem(DAILY_SYNC_STORAGE_KEY, String(at));
  } catch {
    // In-memory value still throttles for this app run.
  }
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Sync today's rollup unless it was synced recently. Skipped mid-session: the
 * streamer already owns the watch read path during a workout, and a rollup is a
 * heavier multi-record query.
 *
 * The attempt is stamped whether or not it produced data, so a device without
 * permissions doesn't re-read on every foreground.
 */
export async function syncDailyVitalsIfStale(now = Date.now()): Promise<boolean> {
  if (isStreaming() || !isSupported()) return false;

  const last = await loadLastDailySync();
  if (last !== null && now - last < DAILY_SYNC_MIN_INTERVAL_MS) return false;

  const today = new Date(now);
  const synced = await syncDailyVitals(today);
  await rememberDailySync(now);

  // Vendor apps keep backfilling a day well after midnight, so the first sync
  // of a new calendar day re-reads yesterday to pick up what landed late.
  if (synced && last !== null && !isSameLocalDay(new Date(last), today)) {
    await syncDailyVitals(new Date(now - 86_400_000));
  }

  return synced;
}

/**
 * Install the foreground trigger for daily rollups and sync once immediately.
 * Idempotent. Returns the matching teardown.
 */
export function startDailyVitalsSync(): () => void {
  void syncDailyVitalsIfStale();

  if (!dailySub) {
    dailySub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void syncDailyVitalsIfStale();
    });
  }

  return stopDailyVitalsSync;
}

/**
 * Tear down the foreground trigger. Also clears the throttle, since the only
 * caller stops on sign-out and the next athlete on this device shouldn't
 * inherit the previous one's cooldown.
 */
export function stopDailyVitalsSync(): void {
  dailySub?.remove();
  dailySub = null;
  lastDailySyncAt = undefined;
  void AsyncStorage.removeItem(DAILY_SYNC_STORAGE_KEY).catch(() => {});
}
