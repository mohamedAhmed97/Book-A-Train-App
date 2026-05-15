import type { Config } from "tailwindcss";

// shadcn-style semantic dark tokens (mirrors Dashboard's dark theme variables).
const DARK = {
  background:           "#070C18",
  foreground:           "#EDF2FF",
  card:                 "#0D1526",
  "card-foreground":    "#EDF2FF",
  popover:              "#0D1526",
  "popover-foreground": "#EDF2FF",
  primary:              "#1565C0",
  "primary-foreground": "#FFFFFF",
  secondary:            "#131E33",
  "secondary-foreground": "#EDF2FF",
  muted:                "#131E33",
  "muted-foreground":   "#7B8DB8",
  accent:               "#00897B",
  "accent-foreground":  "#FFFFFF",
  destructive:          "#E53935",
  "destructive-foreground": "#FFFFFF",
  border:               "#21314E",
  input:                "#21314E",
  ring:                 "#42A5F5",
};

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ...DARK,
        // Legacy tokens still referenced across the existing screens.
        bg: DARK.background,
        bg2: DARK.card,
        bg3: DARK.secondary,
        bg4: "#1A2840",
        bg5: DARK.border,
        coral: DARK.destructive,
        amber: "#F59E0B",
        purple: "#7E57C2",
        txt: DARK.foreground,
        txt2: DARK["muted-foreground"],
        txt3: "#3D4F72",
        "primary-light": "#42A5F5",
        "primary-dark":  "#1976D2",
        "accent-light":  "#26C6A8",
      },
      fontFamily: {
        heading: ["Syne_800ExtraBold"],
        body: ["DMSans_400Regular"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};
export default config;
