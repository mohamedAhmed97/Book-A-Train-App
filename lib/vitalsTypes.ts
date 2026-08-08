/**
 * Shared vocabulary for the two platform readers (Health Connect on Android,
 * HealthKit on iOS). Kept in its own module so neither reader has to import the
 * other — importing healthConnect.ts on iOS would pull in an Android-only
 * native module.
 */

/**
 * Metric keys are open strings, not a closed union — whatever record type the
 * athlete's watch exposes flows through untouched. `lib/metricCatalog.ts`
 * describes the ones we present richly; anything else still reaches the coach.
 */
export type VitalMetric = string;

export interface VitalSample {
  metric: string;
  value: number;
  unit: string;
  /** ISO-8601 instant the watch recorded the reading. */
  recordedAt: string;
}

export type Availability =
  | "unsupported" // wrong platform, or a build without the native module (Expo Go)
  | "unsupported_os" // Android 8 — Health Connect can't be installed at all
  | "not_installed" // Android only — Health Connect app missing but installable
  | "update_required" // Android only
  | "available";

/** States where prompting the athlete to install Health Connect is pointless. */
export function isTerminalUnavailability(availability: Availability): boolean {
  return availability === "unsupported" || availability === "unsupported_os";
}

/**
 * One calendar day's recovery snapshot. An open metric list rather than fixed
 * fields, so a watch that starts reporting something new needs no change here
 * or on the server.
 */
export interface DailyRollup {
  /** ISO-8601 local midnight of the day being summarised. */
  date: string;
  metrics: Array<{ metric: string; value: number; unit: string }>;
}

/**
 * What one platform record type is actually doing on this device.
 *
 * `granted` and `hasData` are deliberately separate: a type can be approved and
 * still return nothing because the watch never writes it, which is the single
 * most common reason a coach sees a metric missing. Telling those two apart is
 * the whole point of the diagnostics screen.
 */
export interface RecordTypeProbe {
  /** Platform identifier, e.g. "HeartRate" or "HKQuantityTypeIdentifierHeartRate". */
  recordType: string;
  /** Metric keys this record type would produce. */
  metrics: string[];
  granted: boolean;
  sampleCount: number;
  /** ISO-8601 instant of the newest sample found, if any. */
  latestAt: string | null;
}

/** Matches the VitalsProvider enum on the API. */
export type VitalsProvider = "HEALTH_CONNECT" | "HEALTH_KIT" | "WEAR_OS" | "BLE" | "MANUAL";

/**
 * The contract each platform reader implements. `vitalsSource.ts` picks one at
 * runtime so the streamer and UI never branch on Platform.OS themselves.
 */
export interface VitalsReader {
  provider: VitalsProvider;
  isSupported(): boolean;
  getAvailability(): Promise<Availability>;
  requestPermissions(): Promise<string[]>;
  getGrantedRecordTypes(): Promise<string[]>;
  openSettings(): Promise<void>;
  /** The subset that changes during a workout, for the in-session poll. */
  readVitals(from: Date, to: Date): Promise<VitalSample[]>;
  /** Everything the athlete has granted, for backfill and daily sync. */
  readAllVitals(from: Date, to: Date): Promise<VitalSample[]>;
  readDailyRollup(day: Date): Promise<DailyRollup | null>;
  detectSourceApps(lookbackDays?: number): Promise<string[]>;
  /** Per-record-type status, for the watch diagnostics screen. */
  probeRecordTypes(lookbackDays?: number): Promise<RecordTypeProbe[]>;
}
