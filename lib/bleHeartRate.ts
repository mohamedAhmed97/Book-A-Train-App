import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { VitalSample } from "@/lib/vitalsTypes";
import {
  accumulateRr,
  base64ToBytes,
  parseHeartRateMeasurement,
  rmssd,
} from "@/lib/bleHeartRateProtocol";

/**
 * Live heart rate over the standard Bluetooth LE Heart Rate Service.
 *
 * This is the brand-agnostic channel. Health Connect covers whatever the
 * vendor's phone app chooses to write, whenever it chooses to write it; this
 * talks to the sensor directly, so it works with any device implementing the
 * standard GATT profile and delivers readings at roughly 1 Hz instead of
 * whenever the vendor next syncs.
 *
 * In practice that means chest straps (Polar H-series, Garmin HRM, Wahoo Tickr)
 * and most sports watches placed in "broadcast heart rate" mode. Lifestyle
 * smartwatches generally do NOT expose this service — they stay on the Health
 * Connect path.
 *
 * The library is required lazily so the JS bundle still loads in Expo Go, where
 * the native module is absent.
 */

// ── GATT identifiers ───────────────────────────────────────────────────────

const HEART_RATE_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HEART_RATE_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";
const BATTERY_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_LEVEL = "00002a19-0000-1000-8000-00805f9b34fb";

/** Remembered so a session can reconnect without making the athlete re-pair. */
const LAST_DEVICE_KEY = "bat_ble_hr_device";

/** Rolling window of accepted intervals — roughly two minutes at 60 bpm. */
const RR_WINDOW = 120;

/** Minimum intervals before RMSSD means anything. */
const RR_MIN_SAMPLES = 20;

// ── Connection state ───────────────────────────────────────────────────────

export type BleState =
  | "idle"
  | "unsupported"
  | "unauthorized"
  | "bluetooth_off"
  | "scanning"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface BleSensor {
  id: string;
  name: string;
  /** Signal strength in dBm; closer to zero is stronger. */
  rssi: number | null;
}

export interface BleStatus {
  state: BleState;
  device: BleSensor | null;
  bpm: number | null;
  batteryPercent: number | null;
  contact: boolean | null;
  /** Newest HRV estimate from the rolling RR window. */
  hrvMs: number | null;
  lastBeatAt: number | null;
}

type Listener = (status: BleStatus) => void;

let status: BleStatus = {
  state: "idle",
  device: null,
  bpm: null,
  batteryPercent: null,
  contact: null,
  hrvMs: null,
  lastBeatAt: null,
};

const listeners = new Set<Listener>();

function publish(patch: Partial<BleStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export function getBleStatus(): BleStatus {
  return status;
}

export function subscribeBle(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

// ── Native module ──────────────────────────────────────────────────────────

type BlePlx = typeof import("react-native-ble-plx");

let cachedModule: BlePlx | null | undefined;
let manager: any = null;

function getModule(): BlePlx | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require("react-native-ble-plx") as BlePlx;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

function getManager(): any | null {
  if (manager) return manager;
  const mod = getModule();
  if (!mod) return null;
  try {
    manager = new mod.BleManager();
    return manager;
  } catch {
    return null;
  }
}

export function isSupported(): boolean {
  return getModule() !== null;
}

// ── Permissions ────────────────────────────────────────────────────────────

/**
 * Android 12 split Bluetooth into SCAN and CONNECT runtime permissions. We
 * declare SCAN with `neverForLocation`, so no location grant is needed there.
 * Below API 31 the platform still gates scanning behind fine location.
 */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const api = typeof Platform.Version === "number" ? Platform.Version : 0;

  try {
    if (api >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        "android.permission.BLUETOOTH_SCAN" as never,
        "android.permission.BLUETOOTH_CONNECT" as never,
      ]);
      return Object.values(result).every((v) => v === "granted");
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === "granted";
  } catch {
    return false;
  }
}

// ── Scanning ───────────────────────────────────────────────────────────────

let scanning = false;

/**
 * Scan for anything advertising the Heart Rate Service. Filtering by service
 * UUID keeps unrelated peripherals — headphones, speakers, tags — out of the
 * athlete's picker.
 *
 * Returns a stop function. The caller must invoke it: an unbounded BLE scan is
 * a meaningful battery drain.
 */
export async function scanForSensors(
  onFound: (sensor: BleSensor) => void,
): Promise<() => void> {
  const bleManager = getManager();
  if (!bleManager) {
    publish({ state: "unsupported" });
    return () => {};
  }

  if (!(await requestBlePermissions())) {
    publish({ state: "unauthorized" });
    return () => {};
  }

  const stop = () => {
    if (!scanning) return;
    scanning = false;
    try {
      bleManager.stopDeviceScan();
    } catch {
      // Manager already torn down.
    }
    if (status.state === "scanning") publish({ state: "idle" });
  };

  scanning = true;
  publish({ state: "scanning" });

  bleManager.startDeviceScan(
    [HEART_RATE_SERVICE],
    { allowDuplicates: false },
    (error: any, device: any) => {
      if (error) {
        // Most commonly Bluetooth switched off mid-scan.
        publish({ state: error?.reason?.includes?.("PoweredOff") ? "bluetooth_off" : "idle" });
        stop();
        return;
      }
      if (!device) return;
      onFound({
        id: device.id,
        // Unnamed peripherals are common; the id at least distinguishes them.
        name: device.name ?? device.localName ?? device.id,
        rssi: typeof device.rssi === "number" ? device.rssi : null,
      });
    },
  );

  return stop;
}

// ── Sample buffer ──────────────────────────────────────────────────────────

/**
 * Notifications arrive at ~1 Hz but uploads happen on the streamer's slower
 * tick, so readings accumulate here in between and are drained in batches.
 */
let buffer: VitalSample[] = [];

/** Bound the buffer so a long upload outage can't grow it without limit. */
const MAX_BUFFER = 2000;

/** Take everything buffered so far. Called by the streamer each tick. */
export function drainSamples(): VitalSample[] {
  const out = buffer;
  buffer = [];
  return out;
}

/** Metrics this channel is currently producing, for the precedence rule. */
export function activeMetrics(): string[] {
  if (status.state !== "connected") return [];
  return status.hrvMs !== null ? ["HEART_RATE", "HRV"] : ["HEART_RATE"];
}

function push(sample: VitalSample) {
  buffer.push(sample);
  if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
}

// ── Connecting ─────────────────────────────────────────────────────────────

let rrWindow: number[] = [];
let lastRr: number | null = null;
let lastHrvEmitAt = 0;
let monitorSub: { remove: () => void } | null = null;
let disconnectSub: { remove: () => void } | null = null;
let connectedId: string | null = null;
let intentionalDisconnect = false;

/** How often to emit a fresh HRV figure from the rolling window. */
const HRV_EMIT_MS = 30_000;

function resetSignalState() {
  rrWindow = [];
  lastRr = null;
  lastHrvEmitAt = 0;
}

function handleMeasurement(bytes: Uint8Array) {
  const measurement = parseHeartRateMeasurement(bytes);
  if (!measurement) return;

  const now = Date.now();
  const at = new Date(now).toISOString();

  // A sensor that explicitly reports lost skin contact is the "bad seal" case —
  // its numbers are noise, so drop them rather than let them skew the session.
  const contactLost = measurement.contact === false;

  if (!contactLost && measurement.bpm > 0) {
    push({ metric: "HEART_RATE", value: measurement.bpm, unit: "bpm", recordedAt: at });
  }

  const folded = accumulateRr(rrWindow, measurement.rrIntervals, lastRr, RR_WINDOW);
  rrWindow = folded.window;
  lastRr = folded.lastRr;

  let hrv = status.hrvMs;
  if (rrWindow.length >= RR_MIN_SAMPLES && now - lastHrvEmitAt >= HRV_EMIT_MS) {
    const value = rmssd(rrWindow);
    if (value !== null) {
      hrv = Math.round(value * 10) / 10;
      push({ metric: "HRV", value: hrv, unit: "ms", recordedAt: at });
      lastHrvEmitAt = now;
    }
  }

  publish({
    bpm: contactLost ? status.bpm : measurement.bpm,
    contact: measurement.contact,
    hrvMs: hrv,
    lastBeatAt: now,
  });
}

async function readBattery(device: any): Promise<void> {
  try {
    const characteristic = await device.readCharacteristicForService(
      BATTERY_SERVICE,
      BATTERY_LEVEL,
    );
    const bytes = base64ToBytes(characteristic?.value ?? "");
    if (bytes.length > 0) publish({ batteryPercent: bytes[0]! });
  } catch {
    // Battery service is optional; absence isn't a failure.
  }
}

/**
 * Connect, subscribe to heart rate notifications, and keep the link up.
 *
 * Straps drop out routinely — the athlete moves out of range, the sensor sheds
 * a moment of contact — so an unexpected disconnect triggers a reconnect rather
 * than ending the stream.
 */
export async function connectToSensor(deviceId: string): Promise<boolean> {
  const bleManager = getManager();
  if (!bleManager) {
    publish({ state: "unsupported" });
    return false;
  }
  if (!(await requestBlePermissions())) {
    publish({ state: "unauthorized" });
    return false;
  }

  intentionalDisconnect = false;
  publish({ state: status.state === "connected" ? "reconnecting" : "connecting" });

  try {
    const device = await bleManager.connectToDevice(deviceId, { autoConnect: false });
    await device.discoverAllServicesAndCharacteristics();

    connectedId = deviceId;
    resetSignalState();

    monitorSub?.remove();
    monitorSub = device.monitorCharacteristicForService(
      HEART_RATE_SERVICE,
      HEART_RATE_MEASUREMENT,
      (error: any, characteristic: any) => {
        if (error || !characteristic?.value) return;
        handleMeasurement(base64ToBytes(characteristic.value));
      },
    );

    disconnectSub?.remove();
    disconnectSub = bleManager.onDeviceDisconnected(deviceId, () => {
      if (intentionalDisconnect) return;
      publish({ state: "reconnecting", bpm: null });
      // Straightforward retry; the athlete may simply have walked away.
      setTimeout(() => {
        if (!intentionalDisconnect && connectedId === deviceId) {
          void connectToSensor(deviceId);
        }
      }, 4000);
    });

    publish({
      state: "connected",
      device: {
        id: deviceId,
        name: device.name ?? device.localName ?? deviceId,
        rssi: typeof device.rssi === "number" ? device.rssi : null,
      },
    });

    void readBattery(device);
    await AsyncStorage.setItem(LAST_DEVICE_KEY, deviceId).catch(() => {});
    return true;
  } catch {
    publish({ state: "idle", bpm: null });
    return false;
  }
}

export async function disconnectSensor(): Promise<void> {
  intentionalDisconnect = true;
  const bleManager = getManager();

  monitorSub?.remove();
  monitorSub = null;
  disconnectSub?.remove();
  disconnectSub = null;

  if (bleManager && connectedId) {
    try {
      await bleManager.cancelDeviceConnection(connectedId);
    } catch {
      // Already gone.
    }
  }

  connectedId = null;
  buffer = [];
  resetSignalState();
  publish({
    state: "idle",
    device: null,
    bpm: null,
    batteryPercent: null,
    contact: null,
    hrvMs: null,
    lastBeatAt: null,
  });
  await AsyncStorage.removeItem(LAST_DEVICE_KEY).catch(() => {});
}

export function isConnected(): boolean {
  return status.state === "connected";
}

/** The strap this athlete last paired, if any. */
export async function rememberedDeviceId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_DEVICE_KEY);
  } catch {
    return null;
  }
}

/**
 * Reconnect to the remembered strap. Called when a session starts so the
 * athlete doesn't have to re-pair before every workout.
 */
export async function reconnectRememberedSensor(): Promise<boolean> {
  if (!isSupported() || isConnected()) return isConnected();
  const deviceId = await rememberedDeviceId();
  if (!deviceId) return false;
  return connectToSensor(deviceId);
}
