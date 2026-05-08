import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#070C18",
        bg2: "#0D1526",
        bg3: "#131E33",
        bg4: "#1A2840",
        bg5: "#21314E",
        primary: { DEFAULT: "#1565C0", light: "#42A5F5", dark: "#1976D2" },
        accent: { DEFAULT: "#00897B", light: "#26C6A8" },
        coral: "#E53935",
        amber: "#F59E0B",
        purple: "#7E57C2",
        txt: "#EDF2FF",
        txt2: "#7B8DB8",
        txt3: "#3D4F72",
      },
      fontFamily: {
        heading: ["Syne_800ExtraBold"],
        body: ["DMSans_400Regular"],
      },
    },
  },
  plugins: [],
};
export default config;
