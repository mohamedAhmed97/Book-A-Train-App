import { Platform } from "react-native";
import type {
  Availability,
  DailyRollup,
  RecordTypeProbe,
  VitalSample,
} from "@/lib/vitalsTypes";
import { aggregateMetric, metricMeta, roundForMetric } from "@/lib/metricCatalog";

/**
 * Thin wrapper over Apple HealthKit — the iOS counterpart to lib/healthConnect.ts.
 *
 * Watches that pair with iPhone (Fitbit, Garmin, Polar, Amazfit, Huawei…) write
 * into HealthKit through their own iOS companion apps, so reading HealthKit
 * covers them the same way reading Health Connect covers the Android side.
 *
 * Note this does NOT cover Wear OS or Samsung Galaxy Watch: those can't pair
 * with an iPhone at all, so no data ever reaches HealthKit for them.
 *
 * Metric coverage is kept deliberately in step with the Android side so a coach
 * sees the same metric keys regardless of what their athlete carries. Same
 * guarding approach too — the native module is absent on Android and in Expo
 * Go, so callers get `unsupported` instead of a redbox.
 */

interface QuantitySpec {
  metric: string;
  /** Unit string passed to HealthKit when querying. */
  unit: string;
  /** Poll on the 15s in-session loop — see the Android reader for the rationale. */
  live?: boolean;
  /** Post-process a raw HealthKit quantity into our unit. */
  convert?: (value: number) => number;
}

/**
 * HealthKit quantity identifiers we read. Adding one is a single entry; the
 * metric key it produces needs no schema change anywhere.
 */
const QUANTITY_TYPES: Record<string, QuantitySpec> = {
  // ── Cardio ────────────────────────────────────────────────────────────────
  HKQuantityTypeIdentifierHeartRate: { metric: "HEART_RATE", unit: "count/min", live: true },
  HKQuantityTypeIdentifierRestingHeartRate: {
    metric: "RESTING_HEART_RATE",
    unit: "count/min",
  },
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: {
    metric: "HRV",
    unit: "ms",
    live: true,
  },
  HKQuantityTypeIdentifierOxygenSaturation: {
    metric: "SPO2",
    unit: "%",
    live: true,
    // HealthKit reports saturation as a 0–1 fraction; our schema and the
    // Android side both use whole percent.
    convert: (v) => (v <= 1 ? v * 100 : v),
  },
  HKQuantityTypeIdentifierRespiratoryRate: {
    metric: "RESPIRATORY_RATE",
    unit: "count/min",
    live: true,
  },
  HKQuantityTypeIdentifierBloodPressureSystolic: {
    metric: "BLOOD_PRESSURE_SYSTOLIC",
    unit: "mmHg",
  },
  HKQuantityTypeIdentifierBloodPressureDiastolic: {
    metric: "BLOOD_PRESSURE_DIASTOLIC",
    unit: "mmHg",
  },

  // ── Recovery ──────────────────────────────────────────────────────────────
  HKQuantityTypeIdentifierBodyTemperature: {
    metric: "SKIN_TEMPERATURE",
    unit: "degC",
    live: true,
  },
  HKQuantityTypeIdentifierBasalBodyTemperature: {
    metric: "BASAL_BODY_TEMPERATURE",
    unit: "degC",
  },

  // ── Activity ──────────────────────────────────────────────────────────────
  HKQuantityTypeIdentifierStepCount: { metric: "STEPS", unit: "count", live: true },
  HKQuantityTypeIdentifierDistanceWalkingRunning: {
    metric: "DISTANCE",
    unit: "m",
    live: true,
  },
  HKQuantityTypeIdentifierDistanceCycling: { metric: "DISTANCE", unit: "m", live: true },
  HKQuantityTypeIdentifierDistanceSwimming: { metric: "DISTANCE", unit: "m", live: true },
  HKQuantityTypeIdentifierActiveEnergyBurned: {
    metric: "ACTIVE_CALORIES",
    unit: "kcal",
    live: true,
  },
  // Deliberately NOT mapped to CALORIES: on Android that key means Health
  // Connect's TotalCaloriesBurned (active + basal). HealthKit has no total
  // energy type — only these two halves — so folding basal into CALORIES would
  // make the same key mean "total" on Android and "resting only" here, and a
  // coach comparing two athletes would be comparing different quantities.
  HKQuantityTypeIdentifierBasalEnergyBurned: {
    metric: "BASAL_CALORIES",
    unit: "kcal",
    live: true,
  },
  HKQuantityTypeIdentifierFlightsClimbed: {
    metric: "FLOORS_CLIMBED",
    unit: "count",
    live: true,
  },
  HKQuantityTypeIdentifierPushCount: {
    metric: "WHEELCHAIR_PUSHES",
    unit: "count",
    live: true,
  },
  HKQuantityTypeIdentifierAppleExerciseTime: { metric: "EXERCISE_MINUTES", unit: "min" },

  // ── Performance ───────────────────────────────────────────────────────────
  HKQuantityTypeIdentifierRunningPower: { metric: "POWER", unit: "W", live: true },
  HKQuantityTypeIdentifierCyclingPower: { metric: "POWER", unit: "W", live: true },
  HKQuantityTypeIdentifierRunningSpeed: { metric: "SPEED", unit: "m/s", live: true },
  HKQuantityTypeIdentifierCyclingSpeed: { metric: "SPEED", unit: "m/s", live: true },
  HKQuantityTypeIdentifierCyclingCadence: {
    metric: "CYCLING_CADENCE",
    unit: "count/min",
    live: true,
  },
  // A length in metres, not a cadence. HealthKit has no step-cadence quantity
  // type at all, so STEPS_CADENCE is simply Android-only rather than faked from
  // this.
  HKQuantityTypeIdentifierWalkingStepLength: {
    metric: "WALKING_STEP_LENGTH",
    unit: "m",
    live: true,
  },
  HKQuantityTypeIdentifierVO2Max: { metric: "VO2_MAX", unit: "ml/(kg*min)" },

  // ── Body composition ──────────────────────────────────────────────────────
  HKQuantityTypeIdentifierBodyMass: { metric: "WEIGHT", unit: "kg" },
  HKQuantityTypeIdentifierHeight: { metric: "HEIGHT", unit: "m" },
  HKQuantityTypeIdentifierBodyFatPercentage: {
    metric: "BODY_FAT",
    unit: "%",
    convert: (v) => (v <= 1 ? v * 100 : v),
  },
  HKQuantityTypeIdentifierLeanBodyMass: { metric: "LEAN_BODY_MASS", unit: "kg" },

  // ── Nutrition ─────────────────────────────────────────────────────────────
  HKQuantityTypeIdentifierDietaryWater: { metric: "HYDRATION", unit: "l" },
  HKQuantityTypeIdentifierDietaryEnergyConsumed: {
    metric: "NUTRITION_CALORIES",
    unit: "kcal",
  },
  HKQuantityTypeIdentifierBloodGlucose: { metric: "BLOOD_GLUCOSE", unit: "mmol/L" },
};

type QuantityId = keyof typeof QUANTITY_TYPES & string;

const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";

const ALL_QUANTITY_IDS = Object.keys(QUANTITY_TYPES) as QuantityId[];

/** Types worth polling while a session is recording. */
const LIVE_QUANTITY_TYPES = ALL_QUANTITY_IDS.filter((id) => QUANTITY_TYPES[id]!.live);

const ALL_READ_TYPES = [...ALL_QUANTITY_IDS, SLEEP_TYPE];

// ── Native module access ───────────────────────────────────────────────────

type HealthKitModule = typeof import("@kingstinct/react-native-healthkit");

let cachedModule: HealthKitModule | null | undefined;

function getModule(): HealthKitModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS !== "ios") {
    cachedModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("@kingstinct/react-native-healthkit") as HealthKitModule;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function isSupported(): boolean {
  return getModule() !== null;
}

/**
 * The library types `unit` against the specific identifier generic, which
 * collapses to `undefined` once the identifier is widened. Since we drive the
 * identifier from a lookup table rather than a literal, borrow a loosened
 * signature — the unit strings are validated by the QUANTITY_TYPES table above.
 */
interface QueryArgs {
  limit: number;
  unit?: string;
  ascending?: boolean;
  filter?: { date?: { startDate?: Date; endDate?: Date } };
}

type LooseQuery = (id: string, options: QueryArgs) => Promise<readonly any[]>;

function quantityQuery(hk: HealthKitModule): LooseQuery {
  return hk.queryQuantitySamples as unknown as LooseQuery;
}

function categoryQuery(hk: HealthKitModule): LooseQuery {
  return hk.queryCategorySamples as unknown as LooseQuery;
}

export async function getAvailability(): Promise<Availability> {
  const hk = getModule();
  if (!hk) return "unsupported";
  try {
    // False on iPad and in some simulator configurations.
    const available = await hk.isHealthDataAvailableAsync();
    return available ? "available" : "unsupported";
  } catch {
    return "unsupported";
  }
}

// ── Permissions ────────────────────────────────────────────────────────────

/**
 * Prompts for read access to every type we understand.
 *
 * Apple deliberately does NOT tell you which read permissions were granted —
 * that would leak health information (knowing the user hid their HR is itself a
 * signal). `requestAuthorization` resolves once the sheet is dismissed,
 * regardless of choices. So unlike Health Connect we can't report exact grants;
 * we probe by reading instead, in `getGrantedRecordTypes`.
 */
export async function requestPermissions(): Promise<string[]> {
  const hk = getModule();
  if (!hk) return [];
  try {
    await hk.requestAuthorization({ toRead: ALL_READ_TYPES as unknown as never });
    return getGrantedRecordTypes();
  } catch {
    return [];
  }
}

/**
 * Best-effort view of what we can actually read. Since iOS won't report read
 * status, this probes each type with a wide-window query and treats "returned
 * something" as granted. Types the athlete owns no data for look identical to
 * denied ones — unavoidable on this platform.
 */
export async function getGrantedRecordTypes(): Promise<string[]> {
  const hk = getModule();
  if (!hk) return [];

  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);

  const results = await Promise.all(
    ALL_QUANTITY_IDS.map(async (id) => {
      try {
        const samples = await quantityQuery(hk)(id, {
          limit: 1,
          filter: { date: { startDate: from, endDate: to } },
        });
        return samples.length > 0 ? id : null;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((r): r is QuantityId => r !== null);
}

/**
 * iOS has no "open Health Connect" equivalent we can deep-link into for
 * per-app permissions; the athlete has to go through Settings themselves.
 */
export async function openSettings(): Promise<void> {
  const { Linking } = await import("react-native");
  try {
    await Linking.openURL("x-apple-health://");
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      // Nothing further we can do.
    }
  }
}

// ── Reading ────────────────────────────────────────────────────────────────

function toSamples(id: QuantityId, records: readonly any[]): VitalSample[] {
  const spec = QUANTITY_TYPES[id]!;
  const out: VitalSample[] = [];

  for (const record of records) {
    if (typeof record.quantity !== "number" || !Number.isFinite(record.quantity)) continue;
    const value = spec.convert ? spec.convert(record.quantity) : record.quantity;

    out.push({
      metric: spec.metric,
      unit: metricMeta(spec.metric).unit,
      value,
      // Instantaneous samples have startDate === endDate; interval samples
      // (steps, calories) get their midpoint, matching the Android mapper.
      recordedAt: new Date(
        record.startDate === record.endDate
          ? record.startDate
          : new Date(record.startDate).getTime() +
            (new Date(record.endDate).getTime() - new Date(record.startDate).getTime()) / 2,
      ).toISOString(),
    });
  }

  return out;
}

async function queryRange(
  hk: HealthKitModule,
  id: QuantityId,
  from: Date,
  to: Date,
): Promise<VitalSample[]> {
  try {
    const samples = await quantityQuery(hk)(id, {
      limit: 0, // non-positive means "all"
      unit: QUANTITY_TYPES[id]!.unit,
      ascending: true,
      filter: { date: { startDate: from, endDate: to } },
    });
    return toSamples(id, samples);
  } catch {
    // Denied type or no data — treat as empty so one refusal doesn't abort the
    // whole read.
    return [];
  }
}

async function readTypes(
  hk: HealthKitModule,
  ids: QuantityId[],
  from: Date,
  to: Date,
): Promise<VitalSample[]> {
  const perType = await Promise.all(ids.map((id) => queryRange(hk, id, from, to)));
  return perType
    .flat()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
}

/** Samples for the metrics that change during a workout. */
export async function readVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const hk = getModule();
  if (!hk) return [];
  return readTypes(hk, LIVE_QUANTITY_TYPES, from, to);
}

/** Every metric in the window, including the slow-moving ones. */
export async function readAllVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const hk = getModule();
  if (!hk) return [];
  return readTypes(hk, ALL_QUANTITY_IDS, from, to);
}

/** Which apps/devices have written heart-rate data recently. */
export async function detectSourceApps(lookbackDays = 7): Promise<string[]> {
  const hk = getModule();
  if (!hk) return [];

  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);

  try {
    const samples = await quantityQuery(hk)("HKQuantityTypeIdentifierHeartRate", {
      limit: 200,
      filter: { date: { startDate: from, endDate: to } },
    });

    const names = new Set<string>();
    for (const s of samples) {
      // Prefer the physical device name ("Apple Watch", "Forerunner 265") and
      // fall back to the writing app.
      const name = s.device?.name ?? s.sourceRevision?.source?.name;
      if (typeof name === "string" && name.length > 0) names.add(name);
    }
    return [...names];
  } catch {
    return [];
  }
}

/**
 * Per-type status for the diagnostics screen.
 *
 * Unlike Health Connect, iOS refuses to report read authorisation at all — so
 * `granted` here is inferred from whether data came back, and is therefore
 * identical to `hasData`. A type the athlete owns no data for is
 * indistinguishable from one they denied; that's an Apple constraint, not
 * something the screen can resolve.
 */
export async function probeRecordTypes(lookbackDays = 7): Promise<RecordTypeProbe[]> {
  const hk = getModule();
  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86_400_000);

  const quantities = await Promise.all(
    ALL_QUANTITY_IDS.map(async (id) => {
      const samples = hk ? await queryRange(hk, id, from, to) : [];
      const latest = samples.reduce<string | null>(
        (newest, s) => (!newest || s.recordedAt > newest ? s.recordedAt : newest),
        null,
      );
      return {
        recordType: id,
        metrics: [...new Set(samples.map((s) => s.metric))],
        granted: samples.length > 0,
        sampleCount: samples.length,
        latestAt: latest,
      };
    }),
  );

  // Sleep is a category type, so it sits outside the quantity loop.
  const sleepMinutes = hk ? await readSleepMinutes(hk, from, to) : null;
  quantities.push({
    recordType: SLEEP_TYPE,
    metrics: sleepMinutes === null ? [] : ["SLEEP_MINUTES"],
    granted: sleepMinutes !== null,
    sampleCount: sleepMinutes === null ? 0 : 1,
    latestAt: null,
  });

  return quantities;
}

/** Total minutes actually asleep on a given day, or null if unavailable. */
async function readSleepMinutes(
  hk: HealthKitModule,
  from: Date,
  to: Date,
): Promise<number | null> {
  try {
    const sleep = await categoryQuery(hk)(SLEEP_TYPE, {
      limit: 0,
      filter: { date: { startDate: from, endDate: to } },
    });
    const asleepMs = sleep
      // HKCategoryValueSleepAnalysis: 0 = inBed, 1 = asleepUnspecified,
      // 3/4/5 = core/deep/REM. Anything but inBed counts as sleep.
      .filter((s) => s.value !== 0)
      .reduce(
        (sum, s) => sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()),
        0,
      );
    return asleepMs > 0 ? Math.round(asleepMs / 60_000) : null;
  } catch {
    // Sleep access denied or absent.
    return null;
  }
}

/**
 * Recovery/readiness snapshot for one calendar day, across every metric the
 * athlete has granted. Mirrors the Android rollup, including how each metric
 * collapses — mean for rates, total for counters, latest for body measurements.
 */
export async function readDailyRollup(day: Date): Promise<DailyRollup | null> {
  const hk = getModule();
  if (!hk) return null;

  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 86_400_000);

  const [samples, sleepMinutes] = await Promise.all([
    readTypes(hk, ALL_QUANTITY_IDS, from, to),
    readSleepMinutes(hk, from, to),
  ]);

  if (samples.length === 0 && sleepMinutes === null) return null;

  const byMetric = new Map<string, VitalSample[]>();
  for (const sample of samples) {
    const bucket = byMetric.get(sample.metric);
    if (bucket) bucket.push(sample);
    else byMetric.set(sample.metric, [sample]);
  }

  const metrics: DailyRollup["metrics"] = [];
  for (const [metric, rows] of byMetric) {
    // readTypes sorts ascending, which is what `last` aggregation assumes.
    const value = aggregateMetric(
      metric,
      rows.map((r) => r.value),
    );
    const rounded = roundForMetric(metric, value);
    if (rounded === null) continue;
    metrics.push({ metric, value: rounded, unit: rows[0]!.unit });
  }

  if (sleepMinutes !== null) {
    metrics.push({ metric: "SLEEP_MINUTES", value: sleepMinutes, unit: "min" });
  }

  return { date: from.toISOString(), metrics };
}
