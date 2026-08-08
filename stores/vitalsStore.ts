import { create } from "zustand";
import type { VitalMetric, VitalSample } from "@/lib/vitalsTypes";

export type StreamState = "idle" | "starting" | "streaming" | "no_data" | "error";

/** Newest value seen for a metric during the current session. */
export interface LatestReading {
  value: number;
  unit: string;
  recordedAt: number;
}

interface VitalsStore {
  state: StreamState;
  /** Set when the watch is linked but not producing samples, or upload failed. */
  message: string | null;
  latest: Partial<Record<VitalMetric, LatestReading>>;
  /** Rolling HR series for the in-app sparkline. Capped, not a full history. */
  heartRateSeries: Array<{ value: number; at: number }>;
  maxHeartRate: number;
  /** Samples read but not yet accepted by the server. */
  pendingCount: number;
  lastUploadAt: number | null;

  setState: (state: StreamState, message?: string | null) => void;
  setMaxHeartRate: (bpm: number) => void;
  ingestLocal: (samples: VitalSample[]) => void;
  setPendingCount: (count: number) => void;
  markUploaded: () => void;
  reset: () => void;
}

/** Roughly 30 minutes at one reading per second — enough for the sparkline. */
const MAX_SERIES_POINTS = 1800;

export const useVitalsStore = create<VitalsStore>((set) => ({
  state: "idle",
  message: null,
  latest: {},
  heartRateSeries: [],
  maxHeartRate: 190,
  pendingCount: 0,
  lastUploadAt: null,

  setState: (state, message = null) => set({ state, message }),

  setMaxHeartRate: (bpm) => set({ maxHeartRate: bpm }),

  ingestLocal: (samples) =>
    set((s) => {
      if (samples.length === 0) return s;

      const latest = { ...s.latest };
      const hrPoints: Array<{ value: number; at: number }> = [];

      for (const sample of samples) {
        const at = new Date(sample.recordedAt).getTime();
        const current = latest[sample.metric];
        // Batches can arrive out of order after a reconnect — only advance.
        if (!current || at >= current.recordedAt) {
          latest[sample.metric] = { value: sample.value, unit: sample.unit, recordedAt: at };
        }
        if (sample.metric === "HEART_RATE") hrPoints.push({ value: sample.value, at });
      }

      const series = hrPoints.length
        ? [...s.heartRateSeries, ...hrPoints]
            .sort((a, b) => a.at - b.at)
            .slice(-MAX_SERIES_POINTS)
        : s.heartRateSeries;

      return { ...s, latest, heartRateSeries: series };
    }),

  setPendingCount: (pendingCount) => set({ pendingCount }),

  markUploaded: () => set({ lastUploadAt: Date.now(), pendingCount: 0 }),

  reset: () =>
    set({
      state: "idle",
      message: null,
      latest: {},
      heartRateSeries: [],
      pendingCount: 0,
      lastUploadAt: null,
    }),
}));

/** HR zone 1–5 from a bpm reading, matching the server's zone math. */
export function zoneFor(bpm: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const pct = bpm / (maxHr > 0 ? maxHr : 190);
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

export const ZONE_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "#38BDF8",
  2: "#10B981",
  3: "#F59E0B",
  4: "#F97316",
  5: "#EF4444",
};
