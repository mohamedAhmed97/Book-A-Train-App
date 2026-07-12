import { create } from "zustand";

export interface Coordinate {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface WorkoutStore {
  isTracking: boolean;
  startTime: number | null;
  coordinates: Coordinate[];
  bookingId: string | null;
  sport: string | null;

  startTracking: (bookingId: string, sport: string) => void;
  stopTracking: () => void;
  addCoordinate: (coord: Coordinate) => void;
  reset: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  isTracking: false,
  startTime: null,
  coordinates: [],
  bookingId: null,
  sport: null,

  startTracking: (bookingId, sport) =>
    set({ isTracking: true, startTime: Date.now(), coordinates: [], bookingId, sport }),

  stopTracking: () => set({ isTracking: false }),

  addCoordinate: (coord) =>
    set((s) => ({ coordinates: [...s.coordinates, coord] })),

  reset: () =>
    set({ isTracking: false, startTime: null, coordinates: [], bookingId: null, sport: null }),
}));
