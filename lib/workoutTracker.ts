import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { getDistance } from "geolib";
import { useWorkoutStore } from "@/stores/workoutStore";

export const LOCATION_TASK = "bat-workout-location";

// Holds the foreground subscription when background permission isn't available
let locationSubscription: Location.LocationSubscription | null = null;

const MET_VALUES: Record<string, number> = {
  Running: 9.8,
  Cycling: 8.0,
  Swimming: 8.0,
  Football: 8.0,
  Basketball: 8.0,
  Tennis: 7.3,
  Volleyball: 4.0,
  Boxing: 12.8,
  Yoga: 3.0,
  Weightlifting: 6.0,
};

export const GPS_SPORTS = new Set(["Running", "Cycling", "Football", "Basketball", "Tennis"]);
export const LAP_SPORTS = new Set(["Swimming"]);

// Must be defined at module top-level for background task registration
TaskManager.defineTask(LOCATION_TASK, ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  const store = useWorkoutStore.getState();
  if (!store.isTracking) return;
  for (const loc of locations) {
    store.addCoordinate({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      timestamp: loc.timestamp,
    });
  }
});

function addCoordFromLocation(loc: Location.LocationObject) {
  const store = useWorkoutStore.getState();
  if (!store.isTracking) return;
  store.addCoordinate({
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    timestamp: loc.timestamp,
  });
}

export async function startWorkout(bookingId: string, sport: string): Promise<boolean> {
  if (!GPS_SPORTS.has(sport)) {
    // Non-GPS sport: timer only, no location needed
    useWorkoutStore.getState().startTracking(bookingId, sport);
    return true;
  }

  // GPS sport: request foreground permission first
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") return false;

  useWorkoutStore.getState().startTracking(bookingId, sport);

  // Try background location (production builds with proper info.plist)
  let usedBackground = false;
  try {
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg === "granted") {
      await Location.startLocationUpdatesAsync(LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Workout in progress",
          notificationBody: "Book a Train is tracking your workout",
        },
      });
      usedBackground = true;
    }
  } catch {
    // Background permission key missing from info.plist (Expo Go / dev) — fall through
  }

  // Fall back to foreground-only tracking
  if (!usedBackground) {
    try {
      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 5000, distanceInterval: 10 },
        addCoordFromLocation,
      );
    } catch {
      // Location updates unavailable (simulator without location simulation) — timer still works
    }
  }

  return true;
}

export async function stopWorkout(): Promise<void> {
  // Stop foreground subscription if active
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  // Stop background task if active
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // ignore
  }
  useWorkoutStore.getState().stopTracking();
}

export interface WorkoutMetrics {
  durationMs: number;
  distanceM?: number;
  avgSpeedKph?: number;
  avgPaceSecPerKm?: number;
  calories?: number;
}

export function calculateMetrics(weightKg = 70): WorkoutMetrics {
  const { startTime, coordinates, sport } = useWorkoutStore.getState();

  const durationMs = startTime ? Date.now() - startTime : 0;
  const durationHours = durationMs / 3_600_000;

  let distanceM: number | undefined;
  let avgSpeedKph: number | undefined;
  let avgPaceSecPerKm: number | undefined;

  if (coordinates.length >= 2 && sport && GPS_SPORTS.has(sport)) {
    let totalM = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalM += getDistance(
        { latitude: coordinates[i - 1]!.latitude, longitude: coordinates[i - 1]!.longitude },
        { latitude: coordinates[i]!.latitude, longitude: coordinates[i]!.longitude },
      );
    }
    distanceM = Math.round(totalM);
    const distanceKm = totalM / 1000;
    avgSpeedKph = durationHours > 0 ? Math.round((distanceKm / durationHours) * 10) / 10 : 0;
    avgPaceSecPerKm = distanceKm > 0 ? Math.round(durationMs / 1000 / distanceKm) : undefined;
  }

  const met = MET_VALUES[sport ?? ""] ?? 6.0;
  const calories = durationHours > 0 ? Math.round(met * weightKg * durationHours) : undefined;

  return { durationMs, distanceM, avgSpeedKph, avgPaceSecPerKm, calories };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
