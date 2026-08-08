import { Platform } from "react-native";

// Lazy-loaded to avoid crashing on Android builds
let AppleHealthKit: any = null;
if (Platform.OS === "ios") {
  try {
    AppleHealthKit = require("react-native-health").default;
  } catch {
    // react-native-health not linked (Expo Go / Android build)
  }
}

// Sports that report meaningful cadence data from HealthKit
const CADENCE_SPORTS = new Set(["Running"]);
// Sports that use cycling distance instead of walking/running distance
const CYCLING_SPORTS = new Set(["Cycling"]);
// Sports that use swimming distance
const SWIMMING_SPORTS = new Set(["Swimming"]);
// All sports for which distance from HealthKit is worth fetching
const DISTANCE_SPORTS = new Set([
  "Running", "Cycling", "Swimming", "Football", "Basketball", "Tennis", "Walking",
]);

export interface HealthKitMetrics {
  heartRateAvg?: number;
  heartRateMin?: number;
  heartRateMax?: number;
  activeCalories?: number;
  distanceM?: number;
  steps?: number;
  cadenceAvg?: number; // steps per minute
}

let initialized = false;

export async function initHealthKit(): Promise<boolean> {
  if (Platform.OS !== "ios" || !AppleHealthKit) return false;
  if (initialized) return true;

  return new Promise((resolve) => {
    const permissions = {
      permissions: {
        read: [
          AppleHealthKit.Constants.Permissions.HeartRate,
          AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
          AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
          AppleHealthKit.Constants.Permissions.DistanceCycling,
          AppleHealthKit.Constants.Permissions.DistanceSwimming,
          AppleHealthKit.Constants.Permissions.StepCount,
        ],
        write: [],
      },
    };

    AppleHealthKit.initHealthKit(permissions, (err: any) => {
      if (!err) initialized = true;
      resolve(!err);
    });
  });
}

// ── callback → promise helpers ──────────────────────────────────────────────

function getHeartRateSamples(options: object): Promise<any[]> {
  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(options, (err: any, results: any[]) => {
      resolve(err ? [] : results);
    });
  });
}

function getActiveEnergyBurned(options: object): Promise<any[]> {
  return new Promise((resolve) => {
    AppleHealthKit.getActiveEnergyBurned(options, (err: any, results: any[]) => {
      resolve(err ? [] : results);
    });
  });
}

function getDistanceWalkingRunning(options: object): Promise<number> {
  return new Promise((resolve) => {
    AppleHealthKit.getDistanceWalkingRunning(options, (err: any, result: any) => {
      resolve(err || result == null ? 0 : result.value ?? 0);
    });
  });
}

function getDistanceCycling(options: object): Promise<number> {
  return new Promise((resolve) => {
    AppleHealthKit.getDistanceCycling(options, (err: any, result: any) => {
      resolve(err || result == null ? 0 : result.value ?? 0);
    });
  });
}

function getDistanceSwimming(options: object): Promise<number> {
  return new Promise((resolve) => {
    AppleHealthKit.getDistanceSwimming(options, (err: any, result: any) => {
      resolve(err || result == null ? 0 : result.value ?? 0);
    });
  });
}

function getStepCount(options: object): Promise<number> {
  return new Promise((resolve) => {
    AppleHealthKit.getStepCount(options, (err: any, result: any) => {
      resolve(err || result == null ? 0 : result.value ?? 0);
    });
  });
}

// ── public API ───────────────────────────────────────────────────────────────

export async function fetchHealthMetrics(
  sport: string,
  startDate: Date,
  endDate: Date,
): Promise<HealthKitMetrics> {
  if (Platform.OS !== "ios" || !AppleHealthKit) return {};

  const ok = await initHealthKit();
  if (!ok) return {};

  const timeRange = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    ascending: true,
    limit: 5000,
  };

  const metrics: HealthKitMetrics = {};

  // Heart rate — available for all sports
  try {
    const hrSamples = await getHeartRateSamples(timeRange);
    if (hrSamples.length > 0) {
      const values = hrSamples.map((s: any) => s.value as number);
      metrics.heartRateAvg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      metrics.heartRateMin = Math.round(Math.min(...values));
      metrics.heartRateMax = Math.round(Math.max(...values));
    }
  } catch {}

  // Active calories — always useful
  try {
    const calSamples = await getActiveEnergyBurned(timeRange);
    if (calSamples.length > 0) {
      const total = calSamples.reduce((sum: number, s: any) => sum + (s.value ?? 0), 0);
      if (total > 0) metrics.activeCalories = Math.round(total);
    }
  } catch {}

  // Distance — sport-specific source
  if (DISTANCE_SPORTS.has(sport)) {
    try {
      let distanceKm = 0;
      if (CYCLING_SPORTS.has(sport)) {
        distanceKm = await getDistanceCycling({ ...timeRange, unit: "km" });
      } else if (SWIMMING_SPORTS.has(sport)) {
        // Swimming distance is returned in meters by react-native-health
        const m = await getDistanceSwimming(timeRange);
        if (m > 0) metrics.distanceM = Math.round(m);
        distanceKm = 0; // handled above
      } else {
        distanceKm = await getDistanceWalkingRunning({ ...timeRange, unit: "km" });
      }
      if (!SWIMMING_SPORTS.has(sport) && distanceKm > 0) {
        metrics.distanceM = Math.round(distanceKm * 1000);
      }
    } catch {}
  }

  // Steps & cadence (running only — cadence = steps per minute)
  if (CADENCE_SPORTS.has(sport)) {
    try {
      const steps = await getStepCount(timeRange);
      if (steps > 0) {
        metrics.steps = Math.round(steps);
        const durationMin = (endDate.getTime() - startDate.getTime()) / 60_000;
        if (durationMin > 0) {
          metrics.cadenceAvg = Math.round(steps / durationMin);
        }
      }
    } catch {}
  }

  return metrics;
}
