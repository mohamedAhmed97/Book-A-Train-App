/**
 * Vectors for the BLE Heart Rate Service decoder.
 *
 * Run: npx tsc --outDir /tmp/bletest lib/bleHeartRateProtocol.ts scripts/ble-protocol-test.ts
 *      && node /tmp/bletest/scripts/ble-protocol-test.js
 *
 * Every vector is a byte layout taken from the Heart Rate Service spec rather
 * than from our own output, so a mistake in the parser can't quietly validate
 * itself.
 */

import {
  accumulateRr,
  base64ToBytes,
  parseHeartRateMeasurement,
  rmssd,
} from "../lib/bleHeartRateProtocol";

// The app has no @types/node — this script is run through node deliberately,
// so declare the one global it needs rather than pulling in node types.
declare const process: { exit(code: number): never };

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`);
    failures++;
  }
}

function bytesToBase64(bytes: number[]): string {
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

const u8 = (...b: number[]) => new Uint8Array(b);

console.log("base64ToBytes");
check("round-trips arbitrary bytes", [...base64ToBytes(bytesToBase64([0x00, 0x10, 0x8b, 0xff, 0x7f]))], [0, 16, 139, 255, 127]);
check("handles padding (1 byte)", [...base64ToBytes(bytesToBase64([0x4d]))], [77]);
check("handles padding (2 bytes)", [...base64ToBytes(bytesToBase64([0x4d, 0x61]))], [77, 97]);
check("empty string", [...base64ToBytes("")], []);

console.log("\nparseHeartRateMeasurement");

// flags 0x00: uint8 HR, no contact support, no energy, no RR
check("uint8 HR", parseHeartRateMeasurement(u8(0x00, 72)), {
  bpm: 72,
  contact: null,
  rrIntervals: [],
  energyKj: null,
});

// flags 0x01: uint16 HR little-endian. 0x012C = 300 (implausible but tests LE order)
check("uint16 HR is little-endian", parseHeartRateMeasurement(u8(0x01, 0x2c, 0x01))?.bpm, 300);

// A uint8 parser reading this would return 0x2c = 44 rather than 300.
check("uint16 flag is honoured", parseHeartRateMeasurement(u8(0x01, 0x2c, 0x01))?.bpm !== 44, true);

// flags 0x06: contact supported (bit2) + detected (bit1)
check("contact detected", parseHeartRateMeasurement(u8(0x06, 60))?.contact, true);
// flags 0x04: contact supported, not detected
check("contact lost", parseHeartRateMeasurement(u8(0x04, 60))?.contact, false);
// flags 0x02 alone: detected bit set but unsupported -> must report null
check("contact bit without support is null", parseHeartRateMeasurement(u8(0x02, 60))?.contact, null);

// flags 0x10: RR present. 0x0400 = 1024 -> exactly 1000 ms
check("RR 1024 units = 1000ms", parseHeartRateMeasurement(u8(0x10, 60, 0x00, 0x04))?.rrIntervals, [1000]);

// Two RR values batched in one notification: 1024 -> 1000ms, 512 -> 500ms
check("multiple RR intervals", parseHeartRateMeasurement(u8(0x10, 60, 0x00, 0x04, 0x00, 0x02))?.rrIntervals, [1000, 500]);

// flags 0x18: energy (bit3) THEN RR (bit4). Energy 0x0064=100 must be skipped
// before RR is read, otherwise RR decodes from the wrong offset.
const withEnergy = parseHeartRateMeasurement(u8(0x18, 60, 0x64, 0x00, 0x00, 0x04));
check("energy parsed", withEnergy?.energyKj, 100);
check("RR read after energy field", withEnergy?.rrIntervals, [1000]);

// flags 0x19: uint16 HR + energy + RR all at once — the maximal layout.
const maximal = parseHeartRateMeasurement(u8(0x19, 0x50, 0x00, 0x64, 0x00, 0x00, 0x04));
check("maximal layout HR", maximal?.bpm, 80);
check("maximal layout energy", maximal?.energyKj, 100);
check("maximal layout RR", maximal?.rrIntervals, [1000]);

// Truncation must not read past the buffer.
check("too short returns null", parseHeartRateMeasurement(u8(0x00)), null);
check("uint16 truncated returns null", parseHeartRateMeasurement(u8(0x01, 0x2c)), null);
check("truncated energy abandons RR", parseHeartRateMeasurement(u8(0x18, 60, 0x64))?.rrIntervals, []);
check("odd trailing byte ignored", parseHeartRateMeasurement(u8(0x10, 60, 0x00, 0x04, 0x00))?.rrIntervals, [1000]);

console.log("\nrmssd");
// Differences are +100 then -100 -> sqrt((10000+10000)/2) = 100
check("known RMSSD", rmssd([800, 900, 800]), 100);
check("flat series is zero", rmssd([800, 800, 800]), 0);
check("single interval is null", rmssd([800]), null);
check("empty is null", rmssd([]), null);

console.log("\naccumulateRr");
check(
  "drops out-of-range intervals",
  accumulateRr([], [100, 800, 5000], null, 10).window,
  [800],
);
check(
  "drops artefact jump but re-anchors",
  // 800 accepted; 1500 is a >200ms jump so rejected yet becomes the anchor;
  // 1520 is within 200ms of that anchor and is accepted.
  accumulateRr([], [800, 1500, 1520], null, 10).window,
  [800, 1520],
);
check("window is capped to maxWindow", accumulateRr([], [800, 810, 820, 830], null, 2).window, [820, 830]);
check("anchor carries across calls", accumulateRr([], [900], 800, 10).window, [900]);
check("anchor rejects far first beat", accumulateRr([], [1200], 800, 10).window, []);

console.log(failures === 0 ? "\n✅ all BLE protocol vectors pass" : `\n❌ ${failures} failing`);
if (failures > 0) process.exit(1);
