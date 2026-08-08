/**
 * Pure decoding for the Bluetooth LE Heart Rate Service.
 *
 * Deliberately free of React Native imports so it can be exercised directly by
 * `scripts/ble-protocol-test.ts` — this is bit-level parsing of a
 * variable-length packet, which is the part of the BLE channel most likely to
 * be quietly wrong and the part least likely to announce it at runtime.
 *
 * Spec: Bluetooth SIG, Heart Rate Service 1.0 (0x180D).
 */

/** Physiologically plausible beat-to-beat interval, in ms (30–200 bpm). */
export const RR_MIN_MS = 300;
export const RR_MAX_MS = 2000;

/**
 * Reject a beat whose interval jumps more than this from the previous one.
 * Ectopic beats and missed detections otherwise dominate RMSSD, which squares
 * every difference and so is acutely sensitive to single artefacts.
 */
export const RR_MAX_JUMP_MS = 200;

export interface HeartRateMeasurement {
  bpm: number;
  /**
   * `true`/`false` only when the sensor supports contact detection; `null` when
   * it doesn't report it at all. A strap that has slipped reports `false` while
   * still sending implausible values.
   */
  contact: boolean | null;
  /** Beat-to-beat intervals in milliseconds, if the sensor sends them. */
  rrIntervals: number[];
  /** Cumulative kJ since the sensor was reset, if present. */
  energyKj: number | null;
}

/**
 * Minimal base64 → bytes. react-native-ble-plx hands characteristic values back
 * as base64, and `atob` isn't dependably present across RN engines — a short
 * decoder is steadier than a polyfill dependency for this one use.
 */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToBytes(input: string): Uint8Array {
  const out = new Uint8Array((input.length * 3) >> 2);
  let bits = 0;
  let acc = 0;
  let index = 0;
  for (const char of input) {
    const value = B64.indexOf(char);
    if (value < 0) continue; // padding, whitespace, or junk
    acc = (acc << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

/**
 * Decode a Heart Rate Measurement (0x2A37) packet.
 *
 * The layout is variable-length and driven by the leading flags byte:
 *   bit 0 — value format: 0 = uint8, 1 = uint16 little-endian
 *   bit 1 — sensor contact detected
 *   bit 2 — sensor contact supported (bit 1 is meaningless without this)
 *   bit 3 — energy expended field present (uint16, kJ)
 *   bit 4 — RR-interval field(s) present (uint16 each, units of 1/1024 s)
 *
 * Fields appear in that order, so every optional field shifts the offset of
 * those after it — which is exactly why this is parsed rather than indexed at
 * fixed positions. Returns null for a packet too short to trust.
 */
export function parseHeartRateMeasurement(bytes: Uint8Array): HeartRateMeasurement | null {
  if (bytes.length < 2) return null;

  const flags = bytes[0]!;
  const is16Bit = (flags & 0x01) !== 0;
  const contactDetected = (flags & 0x02) !== 0;
  const contactSupported = (flags & 0x04) !== 0;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  let offset = 1;

  let bpm: number;
  if (is16Bit) {
    if (bytes.length < offset + 2) return null;
    bpm = bytes[offset]! | (bytes[offset + 1]! << 8);
    offset += 2;
  } else {
    bpm = bytes[offset]!;
    offset += 1;
  }

  let energyKj: number | null = null;
  if (hasEnergy) {
    // A truncated energy field means the rest of the packet can't be located,
    // so RR parsing is abandoned rather than read from the wrong offset.
    if (bytes.length < offset + 2) {
      return { bpm, contact: contactSupported ? contactDetected : null, rrIntervals: [], energyKj: null };
    }
    energyKj = bytes[offset]! | (bytes[offset + 1]! << 8);
    offset += 2;
  }

  const rrIntervals: number[] = [];
  if (hasRR) {
    // Whatever remains is a run of uint16s; a sensor may batch several beats
    // into one notification.
    while (offset + 1 < bytes.length) {
      const raw = bytes[offset]! | (bytes[offset + 1]! << 8);
      offset += 2;
      // Stored in 1/1024-second units, not milliseconds.
      rrIntervals.push((raw * 1000) / 1024);
    }
  }

  return {
    bpm,
    contact: contactSupported ? contactDetected : null,
    rrIntervals,
    energyKj,
  };
}

/**
 * Root mean square of successive differences — the standard short-window HRV
 * measure, and the same quantity Health Connect's `HeartRateVariabilityRmssd`
 * reports, so both channels populate the HRV metric comparably.
 */
export function rmssd(intervals: number[]): number | null {
  if (intervals.length < 2) return null;
  let sumSquares = 0;
  let count = 0;
  for (let i = 1; i < intervals.length; i++) {
    const delta = intervals[i]! - intervals[i - 1]!;
    sumSquares += delta * delta;
    count++;
  }
  if (count === 0) return null;
  return Math.sqrt(sumSquares / count);
}

/**
 * Fold new intervals into a rolling window, dropping implausible values and
 * artefact jumps. Returns the updated window and the new anchor.
 *
 * An artefact re-anchors `lastRr` without being accepted, so a single bad beat
 * doesn't cause every subsequent beat to be rejected against a stale anchor.
 */
export function accumulateRr(
  window: number[],
  incoming: number[],
  lastRr: number | null,
  maxWindow: number,
): { window: number[]; lastRr: number | null } {
  let anchor = lastRr;
  let next = window;

  for (const rr of incoming) {
    if (rr < RR_MIN_MS || rr > RR_MAX_MS) continue;
    if (anchor !== null && Math.abs(rr - anchor) > RR_MAX_JUMP_MS) {
      anchor = rr;
      continue;
    }
    anchor = rr;
    next = next.concat(rr);
  }

  if (next.length > maxWindow) next = next.slice(-maxWindow);
  return { window: next, lastRr: anchor };
}
