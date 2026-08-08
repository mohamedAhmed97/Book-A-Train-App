import { Platform } from "react-native";
import type {
  Availability,
  DailyRollup,
  RecordTypeProbe,
  VitalSample,
} from "@/lib/vitalsTypes";
import { aggregateMetric, metricMeta, roundForMetric } from "@/lib/metricCatalog";

/**
 * Thin wrapper over Android Health Connect.
 *
 * Health Connect is the system-level datastore that Samsung Health, Fitbit,
 * Garmin Connect and Wear OS watches all write into, so reading from it covers
 * most Android watches with one integration instead of one per vendor.
 *
 * We deliberately do NOT curate a short list of record types: whatever the
 * athlete's watch writes and the athlete agrees to share, we read. Adding
 * support for a new record type means one entry in RECORD_MAP below — no schema
 * change anywhere, because metric keys are open strings end to end.
 *
 * Reproductive-health records (menstruation, ovulation, cervical mucus, sexual
 * activity) are the one exclusion. They aren't coaching data, and requesting
 * them would mean asking every athlete to hand a training app their fertility
 * history.
 *
 * Everything here is guarded: the native module only exists in an Android dev
 * build (it is absent in Expo Go and on iOS), so callers get `unsupported`
 * rather than a redbox.
 */

// ── Record mapping ─────────────────────────────────────────────────────────

interface RecordSpec {
  /** Zero or more samples from one Health Connect record. */
  extract: (record: any) => VitalSample[];
  /**
   * Poll on the 15s in-session loop. Slow-moving measurements (body
   * composition, blood glucose, sleep) are excluded so a workout doesn't
   * re-query bone mass four times a minute — the daily sync still reads them.
   */
  live?: boolean;
}

/** Midpoint of an interval record, used as its representative instant. */
function midpoint(record: { startTime: string; endTime: string }): string {
  const start = new Date(record.startTime).getTime();
  const end = new Date(record.endTime).getTime();
  return new Date(start + (end - start) / 2).toISOString();
}

function iso(value: string): string {
  return new Date(value).toISOString();
}

/** One sample, or none when the field the watch was meant to fill is absent. */
function one(metric: string, value: unknown, at: string): VitalSample[] {
  if (typeof value !== "number" || !Number.isFinite(value)) return [];
  return [{ metric, value, unit: metricMeta(metric).unit, recordedAt: at }];
}

/** Records that carry an inner `samples[]` array rather than a single value. */
function fromSamples(
  metric: string,
  samples: unknown,
  pick: (sample: any) => unknown,
): VitalSample[] {
  if (!Array.isArray(samples)) return [];
  return samples.flatMap((sample) => one(metric, pick(sample), iso(sample.time)));
}

function durationMinutes(record: { startTime: string; endTime: string }): number | null {
  const start = new Date(record.startTime).getTime();
  const end = new Date(record.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60_000);
}

/**
 * Every Health Connect record type we read, and how it becomes our metrics.
 *
 * Read results use the `*Result` unit shapes (`inKilocalories`, `inMeters`, …)
 * rather than the `{value, unit}` shape used when writing — see the library's
 * types/results.types.ts.
 */
const RECORD_MAP: Record<string, RecordSpec> = {
  // ── Cardio ────────────────────────────────────────────────────────────────
  HeartRate: {
    live: true,
    // One record wraps many individual beats-per-minute readings.
    extract: (r) => fromSamples("HEART_RATE", r.samples, (s) => s.beatsPerMinute),
  },
  HeartRateVariabilityRmssd: {
    live: true,
    extract: (r) => one("HRV", r.heartRateVariabilityMillis, iso(r.time)),
  },
  RestingHeartRate: {
    extract: (r) => one("RESTING_HEART_RATE", r.beatsPerMinute, iso(r.time)),
  },
  OxygenSaturation: {
    live: true,
    // `percentage` is a bare number on read, but older builds nested it.
    extract: (r) => one("SPO2", r.percentage?.value ?? r.percentage, iso(r.time)),
  },
  RespiratoryRate: {
    live: true,
    extract: (r) => one("RESPIRATORY_RATE", r.rate, iso(r.time)),
  },
  BloodPressure: {
    extract: (r) => [
      ...one("BLOOD_PRESSURE_SYSTOLIC", r.systolic?.inMillimetersOfMercury, iso(r.time)),
      ...one("BLOOD_PRESSURE_DIASTOLIC", r.diastolic?.inMillimetersOfMercury, iso(r.time)),
    ],
  },

  // ── Recovery ──────────────────────────────────────────────────────────────
  BodyTemperature: {
    live: true,
    extract: (r) => one("SKIN_TEMPERATURE", r.temperature?.inCelsius, iso(r.time)),
  },
  BasalBodyTemperature: {
    extract: (r) => one("BASAL_BODY_TEMPERATURE", r.temperature?.inCelsius, iso(r.time)),
  },
  SleepSession: {
    // Credited at wake time so it lands on the day the athlete got up.
    extract: (r) => one("SLEEP_MINUTES", durationMinutes(r), iso(r.endTime)),
  },

  // ── Activity ──────────────────────────────────────────────────────────────
  Steps: {
    live: true,
    extract: (r) => one("STEPS", r.count, midpoint(r)),
  },
  Distance: {
    live: true,
    extract: (r) => one("DISTANCE", r.distance?.inMeters, midpoint(r)),
  },
  TotalCaloriesBurned: {
    live: true,
    extract: (r) => one("CALORIES", r.energy?.inKilocalories, midpoint(r)),
  },
  ActiveCaloriesBurned: {
    live: true,
    extract: (r) => one("ACTIVE_CALORIES", r.energy?.inKilocalories, midpoint(r)),
  },
  BasalMetabolicRate: {
    extract: (r) =>
      one("BASAL_METABOLIC_RATE", r.basalMetabolicRate?.inKilocaloriesPerDay, iso(r.time)),
  },
  ElevationGained: {
    live: true,
    extract: (r) => one("ELEVATION_GAINED", r.elevation?.inMeters, midpoint(r)),
  },
  FloorsClimbed: {
    live: true,
    extract: (r) => one("FLOORS_CLIMBED", r.floors, midpoint(r)),
  },
  WheelchairPushes: {
    live: true,
    extract: (r) => one("WHEELCHAIR_PUSHES", r.count, midpoint(r)),
  },
  ExerciseSession: {
    extract: (r) => one("EXERCISE_MINUTES", durationMinutes(r), iso(r.endTime)),
  },

  // ── Performance ───────────────────────────────────────────────────────────
  Power: {
    live: true,
    extract: (r) => fromSamples("POWER", r.samples, (s) => s.power?.inWatts),
  },
  Speed: {
    live: true,
    extract: (r) => fromSamples("SPEED", r.samples, (s) => s.speed?.inMetersPerSecond),
  },
  CyclingPedalingCadence: {
    live: true,
    extract: (r) =>
      fromSamples("CYCLING_CADENCE", r.samples, (s) => s.revolutionsPerMinute),
  },
  StepsCadence: {
    live: true,
    extract: (r) => fromSamples("STEPS_CADENCE", r.samples, (s) => s.rate),
  },
  Vo2Max: {
    extract: (r) => one("VO2_MAX", r.vo2MillilitersPerMinuteKilogram, iso(r.time)),
  },

  // ── Body composition ──────────────────────────────────────────────────────
  Weight: {
    extract: (r) => one("WEIGHT", r.weight?.inKilograms, iso(r.time)),
  },
  Height: {
    extract: (r) => one("HEIGHT", r.height?.inMeters, iso(r.time)),
  },
  BodyFat: {
    extract: (r) => one("BODY_FAT", r.percentage?.value ?? r.percentage, iso(r.time)),
  },
  LeanBodyMass: {
    extract: (r) => one("LEAN_BODY_MASS", r.mass?.inKilograms, iso(r.time)),
  },
  BoneMass: {
    extract: (r) => one("BONE_MASS", r.mass?.inKilograms, iso(r.time)),
  },
  BodyWaterMass: {
    extract: (r) => one("BODY_WATER_MASS", r.mass?.inKilograms, iso(r.time)),
  },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  Hydration: {
    extract: (r) => one("HYDRATION", r.volume?.inLiters, midpoint(r)),
  },
  Nutrition: {
    // Only the energy field maps onto a coaching metric; the ~40 micronutrient
    // fields are left alone.
    extract: (r) => one("NUTRITION_CALORIES", r.energy?.inKilocalories, midpoint(r)),
  },
  BloodGlucose: {
    extract: (r) => one("BLOOD_GLUCOSE", r.level?.inMillimolesPerLiter, iso(r.time)),
  },
};

export type RecordType = keyof typeof RECORD_MAP & string;

const ALL_RECORD_TYPES = Object.keys(RECORD_MAP) as RecordType[];

/** Record types worth re-reading every 15s during a recording session. */
const LIVE_RECORD_TYPES = ALL_RECORD_TYPES.filter((t) => RECORD_MAP[t]!.live);

/**
 * Capability permissions rather than record types.
 *
 * `BackgroundAccessPermission` lets the reader run while the app is backgrounded
 * — without it a session minimised mid-workout stops collecting.
 * `ReadHealthDataHistory` lifts Health Connect's default 30-day read window,
 * which matters the first time an athlete links a watch they've owned for years.
 */
const CAPABILITY_PERMISSIONS = [
  "BackgroundAccessPermission",
  "ReadHealthDataHistory",
] as const;

export const READ_PERMISSIONS = [
  ...ALL_RECORD_TYPES.map((recordType) => ({ accessType: "read" as const, recordType })),
  ...CAPABILITY_PERMISSIONS.map((recordType) => ({ accessType: "read" as const, recordType })),
];

// ── Native module access ───────────────────────────────────────────────────

type HealthConnectModule = typeof import("react-native-health-connect");

let cachedModule: HealthConnectModule | null | undefined;

function getModule(): HealthConnectModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS !== "android") {
    cachedModule = null;
    return null;
  }
  try {
    // Required lazily so the bundle still loads on iOS and in Expo Go, where
    // the native side isn't linked.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("react-native-health-connect") as HealthConnectModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isSupported(): boolean {
  return getModule() !== null;
}

let initialized = false;

async function ensureInitialized(): Promise<HealthConnectModule | null> {
  const hc = getModule();
  if (!hc) return null;
  if (initialized) return hc;
  try {
    const ok = await hc.initialize();
    initialized = ok;
    return ok ? hc : null;
  } catch {
    return null;
  }
}

/**
 * Health Connect's client library builds against API 26, but the provider app
 * that actually stores the data requires Android 9 (API 28) — it's bundled into
 * the OS from Android 14 and installable from Play on 9 through 13. Below 28
 * there is nothing to install, so this is checked before `getSdkStatus()`,
 * whose `SDK_UNAVAILABLE` would otherwise be reported as "not installed" and
 * send the athlete to a Play listing their phone can't accept.
 */
const MIN_HEALTH_CONNECT_API = 28;

export async function getAvailability(): Promise<Availability> {
  const hc = getModule();
  if (!hc) return "unsupported";

  // Platform.Version is the API level (a number) on Android.
  const apiLevel = typeof Platform.Version === "number" ? Platform.Version : 0;
  if (apiLevel > 0 && apiLevel < MIN_HEALTH_CONNECT_API) return "unsupported_os";

  try {
    const status = await hc.getSdkStatus();
    if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return "available";
    if (status === hc.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
      return "update_required";
    return "not_installed";
  } catch {
    return "unsupported";
  }
}

// ── Permissions ────────────────────────────────────────────────────────────

/**
 * Prompts for read access to everything we can read. The athlete can approve
 * any subset — Health Connect shows them the full list with per-type toggles —
 * so the return value is the source of truth, not an all-or-nothing signal.
 */
export async function requestPermissions(): Promise<string[]> {
  const hc = await ensureInitialized();
  if (!hc) return [];
  try {
    const granted = await hc.requestPermission(READ_PERMISSIONS as never);
    return granted
      .filter((p: { accessType: string }) => p.accessType === "read")
      .map((p: { recordType: string }) => p.recordType);
  } catch {
    return [];
  }
}

export async function getGrantedRecordTypes(): Promise<string[]> {
  const hc = await ensureInitialized();
  if (!hc) return [];
  try {
    const granted = await hc.getGrantedPermissions();
    return granted
      .filter((p: { accessType: string }) => p.accessType === "read")
      .map((p: { recordType: string }) => p.recordType);
  } catch {
    return [];
  }
}

/** Granted permissions that are actually readable record types. */
async function grantedReadableTypes(): Promise<RecordType[]> {
  const granted = new Set(await getGrantedRecordTypes());
  return ALL_RECORD_TYPES.filter((t) => granted.has(t));
}

export async function openSettings(): Promise<void> {
  const hc = getModule();
  if (!hc) return;
  try {
    await hc.openHealthConnectSettings();
  } catch {
    // Settings intent unavailable — nothing useful to fall back to.
  }
}

// ── Reading ────────────────────────────────────────────────────────────────

async function readRange(
  hc: HealthConnectModule,
  recordType: RecordType,
  from: Date,
  to: Date,
): Promise<VitalSample[]> {
  try {
    const result = await hc.readRecords(recordType as never, {
      timeRangeFilter: {
        operator: "between",
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    // The library returns `{records}` on v3+ and a bare array on older versions.
    const records = (Array.isArray(result) ? result : result.records) as any[];
    const spec = RECORD_MAP[recordType];
    if (!spec) return [];
    return records.flatMap((record) => {
      try {
        return spec.extract(record);
      } catch {
        // One malformed record shouldn't lose the rest of the batch.
        return [];
      }
    });
  } catch {
    // A record type the athlete declined throws — treat as "no data" so one
    // denied permission doesn't abort the whole read.
    return [];
  }
}

async function readTypes(
  hc: HealthConnectModule,
  types: RecordType[],
  from: Date,
  to: Date,
): Promise<VitalSample[]> {
  const perType = await Promise.all(types.map((t) => readRange(hc, t, from, to)));
  return perType
    .flat()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

/**
 * Samples written in `[from, to)` for the metrics that change during a workout.
 * Called on a short interval while a session is recording, so it reads the live
 * subset rather than all ~32 types.
 */
export async function readVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const hc = await ensureInitialized();
  if (!hc) return [];
  return readTypes(hc, LIVE_RECORD_TYPES, from, to);
}

/** Every metric in the window, including the slow-moving ones. */
export async function readAllVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const hc = await ensureInitialized();
  if (!hc) return [];
  const types = await grantedReadableTypes();
  return readTypes(hc, types.length > 0 ? types : ALL_RECORD_TYPES, from, to);
}

/**
 * Package names of the vendor apps that write into Health Connect, mapped to
 * something showable. The athlete's watch is invisible to us — what we can see
 * is which companion app put the data there, which is the useful thing to
 * confirm back to them ("reading from Samsung Health").
 */
const VENDOR_NAMES: Record<string, string> = {
  "com.sec.android.app.shealth": "Samsung Health",
  "com.google.android.apps.fitness": "Google Fit",
  "com.fitbit.FitbitMobile": "Fitbit",
  "com.garmin.android.apps.connectmobile": "Garmin Connect",
  "com.polar.polarflow": "Polar Flow",
  "com.huawei.health": "Huawei Health",
  "com.xiaomi.wearable": "Mi Fitness",
  "com.whoop.android": "WHOOP",
  "com.ouraring.oura": "Oura",
  "com.google.android.apps.healthdata": "Health Connect",
};

/** Which companion apps have written heart-rate data recently. */
export async function detectSourceApps(lookbackDays = 7): Promise<string[]> {
  const hc = await ensureInitialized();
  if (!hc) return [];

  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);

  try {
    const result = await hc.readRecords("HeartRate" as never, {
      timeRangeFilter: {
        operator: "between",
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    const records = (Array.isArray(result) ? result : result.records) as any[];

    const origins = new Set<string>();
    for (const record of records) {
      const pkg = record.metadata?.dataOrigin;
      if (typeof pkg === "string" && pkg.length > 0) {
        origins.add(VENDOR_NAMES[pkg] ?? pkg);
      }
    }
    return [...origins];
  } catch {
    return [];
  }
}

/**
 * Per-record-type status for the diagnostics screen: what we asked for, what
 * the athlete approved, and — separately — what actually came back.
 *
 * Those last two diverging is the normal case, not an error: Health Connect
 * happily grants read access to a record type the athlete's watch has never
 * written. Distinguishing "denied" from "granted but empty" is what makes this
 * worth having when checking a new watch brand.
 */
export async function probeRecordTypes(lookbackDays = 7): Promise<RecordTypeProbe[]> {
  const hc = await ensureInitialized();
  const granted = new Set(await getGrantedRecordTypes());

  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);

  return Promise.all(
    ALL_RECORD_TYPES.map(async (recordType) => {
      const samples = hc ? await readRange(hc, recordType, from, to) : [];
      const latest = samples.reduce<string | null>(
        (newest, s) => (!newest || s.recordedAt > newest ? s.recordedAt : newest),
        null,
      );
      return {
        recordType,
        // Derived from a real read rather than a static table, so it reflects
        // what this record type genuinely produces on this device.
        metrics: [...new Set(samples.map((s) => s.metric))],
        granted: granted.has(recordType),
        sampleCount: samples.length,
        latestAt: latest,
      };
    }),
  );
}

/**
 * Recovery/readiness snapshot for one calendar day, across every metric the
 * athlete has granted. Each metric collapses by the rule in the catalog — mean
 * for rates, total for counters, latest for body measurements.
 */
export async function readDailyRollup(day: Date): Promise<DailyRollup | null> {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86_400_000);

  const samples = await readAllVitals(from, to);
  if (samples.length === 0) return null;

  const byMetric = new Map<string, VitalSample[]>();
  for (const sample of samples) {
    const bucket = byMetric.get(sample.metric);
    if (bucket) bucket.push(sample);
    else byMetric.set(sample.metric, [sample]);
  }

  const metrics: DailyRollup["metrics"] = [];
  for (const [metric, rows] of byMetric) {
    // readAllVitals sorts ascending, which is what `last` aggregation assumes.
    const value = aggregateMetric(
      metric,
      rows.map((r) => r.value),
    );
    const rounded = roundForMetric(metric, value);
    if (rounded === null) continue;
    metrics.push({ metric, value: rounded, unit: rows[0]!.unit });
  }

  return { date: from.toISOString(), metrics };
}
