import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";

// Write a 4-byte little-endian uint32 into a DataView
function setU32(v: DataView, offset: number, value: number) {
  v.setUint32(offset, value, true);
}

// Build a minimal PCM WAV in memory and return as base64
function buildWav(tones: { freq: number; durationMs: number }[]): string {
  const sampleRate = 22050;
  const totalMs = tones.reduce((s, t) => s + t.durationMs, 0);
  const numSamples = Math.floor((sampleRate * totalMs) / 1000);
  const dataBytes = numSamples * 2; // 16-bit mono

  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);

  // RIFF / WAVE header
  "RIFF".split("").forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  setU32(view, 4, 36 + dataBytes);
  "WAVE".split("").forEach((c, i) => view.setUint8(8 + i, c.charCodeAt(0)));
  "fmt ".split("").forEach((c, i) => view.setUint8(12 + i, c.charCodeAt(0)));
  setU32(view, 16, 16);            // sub-chunk size
  view.setUint16(20, 1, true);     // PCM = 1
  view.setUint16(22, 1, true);     // mono
  setU32(view, 24, sampleRate);
  setU32(view, 28, sampleRate * 2); // byte rate
  view.setUint16(32, 2, true);     // block align
  view.setUint16(34, 16, true);    // bits per sample
  "data".split("").forEach((c, i) => view.setUint8(36 + i, c.charCodeAt(0)));
  setU32(view, 40, dataBytes);

  // Generate samples tone by tone
  let sampleIndex = 0;
  for (const { freq, durationMs } of tones) {
    const count = Math.floor((sampleRate * durationMs) / 1000);
    for (let i = 0; i < count && sampleIndex < numSamples; i++, sampleIndex++) {
      const t = i / sampleRate;
      // Smooth envelope: 5 ms fade-in / 5 ms fade-out per tone
      const fadeLen = Math.floor(sampleRate * 0.005);
      const envelope =
        i < fadeLen ? i / fadeLen :
        i > count - fadeLen ? (count - i) / fadeLen : 1;
      const sample = Math.round(Math.sin(2 * Math.PI * freq * t) * 28000 * envelope);
      view.setInt16(44 + sampleIndex * 2, sample, true);
    }
  }

  // Convert ArrayBuffer → base64
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Cache file URIs so we only generate once per session
const cache: Record<string, string> = {};

async function getUri(key: string, tones: { freq: number; durationMs: number }[]): Promise<string> {
  if (cache[key]) return cache[key];
  const base64 = buildWav(tones);
  const uri = `${FileSystem.cacheDirectory}${key}.wav`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  cache[key] = uri;
  return uri;
}

async function play(key: string, tones: { freq: number; durationMs: number }[]) {
  try {
    const uri = await getUri(key, tones);
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync().catch(() => {});
    });
  } catch {
    // Silently ignore audio errors so the timer never breaks
  }
}

// Short sharp beep — countdown tick (last 3 s warning)
export function playBeep() {
  return play("wod_beep", [{ freq: 880, durationMs: 120 }]);
}

// Two ascending beeps — phase change (EMOM new minute / TABATA phase switch)
export function playPhaseChange() {
  return play("wod_phase", [
    { freq: 660, durationMs: 100 },
    { freq: 880, durationMs: 100 },
  ]);
}

// Three ascending notes — workout complete
export function playDone() {
  return play("wod_done", [
    { freq: 523, durationMs: 180 }, // C5
    { freq: 659, durationMs: 180 }, // E5
    { freq: 784, durationMs: 400 }, // G5
  ]);
}
