/**
 * Catalog of watch metrics.
 *
 * Metric keys are open strings, not an enum: whatever record type the athlete's
 * watch grants us flows through to storage untouched. This table exists only to
 * describe metrics we know how to present nicely — how to roll them up, what
 * unit they carry, which group they belong to. A key that isn't listed here is
 * still stored, still returned to the coach, and renders from `fallbackMeta`.
 *
 * Keep this file in sync with the copies in the app (`lib/metricCatalog.ts`) and
 * the dashboard (`src/lib/metricCatalog.ts`) — same duplication pattern as
 * `services/vitals.ts` / dashboard `lib/vitals.ts`.
 */

/** How a series of samples collapses into one session/day number. */
export type MetricAgg =
  /** Mean of the samples — rates and instantaneous readings. */
  | "avg"
  /** Total across the window — counters like steps and calories. */
  | "sum"
  /** Most recent value — slow-moving body measurements. */
  | "last";

export type MetricGroup =
  | "cardio"
  | "recovery"
  | "activity"
  | "performance"
  | "body"
  | "nutrition"
  | "other";

export interface MetricMeta {
  key: string;
  /** English fallback. UIs prefer their own i18n lookup and use this if absent. */
  label: string;
  unit: string;
  agg: MetricAgg;
  decimals: number;
  group: MetricGroup;
  /**
   * Worth polling on the 15s in-session loop. Slow-moving body measurements are
   * excluded so a workout doesn't re-query bone mass four times a minute; they
   * are still read in full by the daily sync.
   */
  live: boolean;
}

function meta(
  key: string,
  label: string,
  unit: string,
  agg: MetricAgg,
  group: MetricGroup,
  decimals = 0,
  live = false,
): MetricMeta {
  return { key, label, unit, agg, decimals, group, live };
}

export const METRIC_META: Record<string, MetricMeta> = Object.fromEntries(
  [
    // ── Cardio ──────────────────────────────────────────────────────────────
    meta("HEART_RATE", "Heart rate", "bpm", "avg", "cardio", 0, true),
    meta("RESTING_HEART_RATE", "Resting HR", "bpm", "avg", "cardio", 0),
    meta("HRV", "HRV", "ms", "avg", "cardio", 1, true),
    meta("SPO2", "SpO₂", "%", "avg", "cardio", 1, true),
    meta("RESPIRATORY_RATE", "Respiratory rate", "br/min", "avg", "cardio", 1, true),
    meta("BLOOD_PRESSURE_SYSTOLIC", "Systolic", "mmHg", "avg", "cardio", 0),
    meta("BLOOD_PRESSURE_DIASTOLIC", "Diastolic", "mmHg", "avg", "cardio", 0),

    // ── Recovery ────────────────────────────────────────────────────────────
    meta("SLEEP_MINUTES", "Sleep", "min", "sum", "recovery", 0),
    meta("SKIN_TEMPERATURE", "Skin temp", "°C", "avg", "recovery", 1, true),
    meta("BASAL_BODY_TEMPERATURE", "Basal temp", "°C", "avg", "recovery", 1),

    // ── Activity ────────────────────────────────────────────────────────────
    meta("STEPS", "Steps", "steps", "sum", "activity", 0, true),
    meta("DISTANCE", "Distance", "m", "sum", "activity", 0, true),
    // CALORIES is active + basal combined, which only Android reports directly.
    // iOS exposes the two halves separately, hence BASAL_CALORIES alongside it.
    meta("CALORIES", "Calories", "kcal", "sum", "activity", 0, true),
    meta("ACTIVE_CALORIES", "Active calories", "kcal", "sum", "activity", 0, true),
    meta("BASAL_CALORIES", "Resting calories", "kcal", "sum", "activity", 0, true),
    meta("BASAL_METABOLIC_RATE", "BMR", "kcal/day", "avg", "activity", 0),
    meta("FLOORS_CLIMBED", "Floors", "floors", "sum", "activity", 0, true),
    meta("ELEVATION_GAINED", "Elevation gain", "m", "sum", "activity", 0, true),
    meta("EXERCISE_MINUTES", "Exercise", "min", "sum", "activity", 0),
    meta("WHEELCHAIR_PUSHES", "Pushes", "pushes", "sum", "activity", 0, true),

    // ── Performance ─────────────────────────────────────────────────────────
    meta("POWER", "Power", "W", "avg", "performance", 0, true),
    meta("SPEED", "Speed", "m/s", "avg", "performance", 2, true),
    meta("CYCLING_CADENCE", "Cycling cadence", "rpm", "avg", "performance", 0, true),
    meta("STEPS_CADENCE", "Step cadence", "spm", "avg", "performance", 0, true),
    meta("WALKING_STEP_LENGTH", "Step length", "m", "avg", "performance", 2, true),
    meta("VO2_MAX", "VO₂ max", "mL/kg/min", "avg", "performance", 1),

    // ── Body composition ────────────────────────────────────────────────────
    meta("WEIGHT", "Weight", "kg", "last", "body", 1),
    meta("HEIGHT", "Height", "m", "last", "body", 2),
    meta("BODY_FAT", "Body fat", "%", "last", "body", 1),
    meta("LEAN_BODY_MASS", "Lean mass", "kg", "last", "body", 1),
    meta("BONE_MASS", "Bone mass", "kg", "last", "body", 1),
    meta("BODY_WATER_MASS", "Body water", "kg", "last", "body", 1),

    // ── Nutrition ───────────────────────────────────────────────────────────
    meta("HYDRATION", "Hydration", "L", "sum", "nutrition", 2),
    meta("BLOOD_GLUCOSE", "Blood glucose", "mmol/L", "avg", "nutrition", 1),
    meta("NUTRITION_CALORIES", "Intake", "kcal", "sum", "nutrition", 0),
  ].map((m) => [m.key, m]),
);

/** `SNAKE_CASE` → `Snake case`, for metrics that postdate this catalog. */
export function humanizeMetricKey(key: string): string {
  const words = key.toLowerCase().split("_").filter(Boolean);
  if (words.length === 0) return key;
  return words.join(" ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Description of any metric key, known or not. Unknown keys aggregate as `avg`,
 * which is the safe default — summing something that turns out to be a rate
 * would produce a meaningless number, whereas averaging a counter is merely
 * uninteresting.
 */
export function metricMeta(key: string, unit?: string): MetricMeta {
  const known = METRIC_META[key];
  if (known) return known;
  return {
    key,
    label: humanizeMetricKey(key),
    unit: unit ?? "",
    agg: "avg",
    decimals: 1,
    group: "other",
    live: false,
  };
}

/**
 * Collapse samples into the single number this metric is summarised by.
 * Assumes `samples` is ordered oldest-first, which matters only for `last`.
 */
export function aggregateMetric(
  key: string,
  values: number[],
  agg: MetricAgg = metricMeta(key).agg,
): number | null {
  if (values.length === 0) return null;
  switch (agg) {
    case "sum":
      return values.reduce((total, v) => total + v, 0);
    case "last":
      return values[values.length - 1]!;
    case "avg":
    default:
      return values.reduce((total, v) => total + v, 0) / values.length;
  }
}

export function roundForMetric(key: string, value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** metricMeta(key).decimals;
  return Math.round(value * factor) / factor;
}

/** "7h 20m" / "45m" — for metrics whose natural unit is minutes. */
export function formatMinutes(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Display string for one metric value, unit included.
 *
 * Handles the few metrics whose raw unit reads badly — minutes past an hour,
 * metres past a kilometre — and otherwise rounds to the catalog's precision.
 * Unknown metrics fall through to "value unit", which is always readable even
 * when we know nothing else about the key.
 */
export function formatMetricValue(
  key: string,
  value: number | null | undefined,
  unit?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  if (key === "SLEEP_MINUTES" || key === "EXERCISE_MINUTES") return formatMinutes(value);
  if (key === "DISTANCE" && Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }

  const spec = metricMeta(key, unit);
  const rounded = roundForMetric(key, value) ?? value;
  const shown = rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: spec.decimals,
  });
  const suffix = unit ?? spec.unit;
  // Percent and degree units read better tight against the number.
  if (suffix === "%" || suffix === "°C") return `${shown}${suffix}`;
  return suffix ? `${shown} ${suffix}` : shown;
}
