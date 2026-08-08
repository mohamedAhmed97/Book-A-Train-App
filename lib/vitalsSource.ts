import { Platform } from "react-native";
import type {
  Availability,
  DailyRollup,
  RecordTypeProbe,
  VitalsProvider,
  VitalSample,
} from "@/lib/vitalsTypes";

/**
 * Picks the right watch data source for the platform and re-exports one API, so
 * the streamer and the UI never branch on Platform.OS.
 *
 *   Android → Health Connect (Samsung Health, Fitbit, Garmin, Wear OS)
 *   iOS     → Apple HealthKit (Fitbit, Garmin, Polar, Amazfit — NOT Wear OS,
 *             which cannot pair with an iPhone at all)
 *
 * Both readers are required lazily. A static import of either would pull a
 * native module that doesn't exist on the other platform.
 */

type Reader = typeof import("@/lib/vitalsHealthConnect") | typeof import("@/lib/vitalsHealthKit");

let cached: Reader | null | undefined;

function reader(): Reader | null {
  if (cached !== undefined) return cached;
  try {
    if (Platform.OS === "android") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cached = require("@/lib/vitalsHealthConnect") as Reader;
    } else if (Platform.OS === "ios") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      cached = require("@/lib/vitalsHealthKit") as Reader;
    } else {
      cached = null; // web
    }
  } catch {
    cached = null;
  }
  return cached;
}

/** Which provider string to stamp on uploaded samples. */
export function currentProvider(): VitalsProvider {
  return Platform.OS === "ios" ? "HEALTH_KIT" : "HEALTH_CONNECT";
}

export function isSupported(): boolean {
  return reader()?.isSupported() ?? false;
}

export async function getAvailability(): Promise<Availability> {
  const r = reader();
  if (!r) return "unsupported";
  return r.getAvailability();
}

export async function requestPermissions(): Promise<string[]> {
  const r = reader();
  if (!r) return [];
  return r.requestPermissions();
}

export async function getGrantedRecordTypes(): Promise<string[]> {
  const r = reader();
  if (!r) return [];
  return r.getGrantedRecordTypes();
}

export async function openSettings(): Promise<void> {
  const r = reader();
  if (!r) return;
  return r.openSettings();
}

/** The subset that changes during a workout — for the in-session poll. */
export async function readVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const r = reader();
  if (!r) return [];
  return r.readVitals(from, to);
}

/** Everything the athlete has granted — for backfill and the daily sync. */
export async function readAllVitals(from: Date, to: Date): Promise<VitalSample[]> {
  const r = reader();
  if (!r) return [];
  return r.readAllVitals(from, to);
}

export async function readDailyRollup(day: Date): Promise<DailyRollup | null> {
  const r = reader();
  if (!r) return null;
  return r.readDailyRollup(day);
}

export async function detectSourceApps(lookbackDays = 7): Promise<string[]> {
  const r = reader();
  if (!r) return [];
  return r.detectSourceApps(lookbackDays);
}

/** Per-record-type status — powers the watch diagnostics screen. */
export async function probeRecordTypes(lookbackDays = 7): Promise<RecordTypeProbe[]> {
  const r = reader();
  if (!r) return [];
  return r.probeRecordTypes(lookbackDays);
}

export type {
  Availability,
  DailyRollup,
  RecordTypeProbe,
  VitalSample,
  VitalsProvider,
};
