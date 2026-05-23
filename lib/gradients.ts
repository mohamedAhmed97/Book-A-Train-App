/**
 * Gradient palette. Tuples are passed to <LinearGradient colors={...} />.
 * Keep these readonly so TS narrows them into the strict colors prop.
 */
export const gradients = {
  hero:   ["#1565C0", "#3B82F6", "#14B8A6"] as const,
  cool:   ["#0F766E", "#1565C0"] as const,
  warm:   ["#F59E0B", "#F43F5E"] as const,
  sunset: ["#F43F5E", "#7C3AED"] as const,
  ocean:  ["#1E40AF", "#0EA5E9", "#06B6D4"] as const,
  forest: ["#14B8A6", "#10B981"] as const,
  fire:   ["#F97316", "#EF4444"] as const,
  night:  ["#0B1226", "#1A2840"] as const,
} as const;

export type GradientName = keyof typeof gradients;
