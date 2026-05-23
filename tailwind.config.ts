import type { Config } from "tailwindcss";

const withOpacity = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg:               withOpacity("--color-bg"),
        bg2:              withOpacity("--color-bg2"),
        bg3:              withOpacity("--color-bg3"),
        bg4:              withOpacity("--color-bg4"),
        bg5:              withOpacity("--color-bg5"),

        txt:              withOpacity("--color-txt"),
        txt2:             withOpacity("--color-txt2"),
        txt3:             withOpacity("--color-txt3"),

        primary:          withOpacity("--color-primary"),
        "primary-light":  withOpacity("--color-primary-light"),
        "primary-dark":   withOpacity("--color-primary-dark"),
        accent:           withOpacity("--color-accent"),
        "accent-light":   withOpacity("--color-accent-light"),

        coral:            withOpacity("--color-coral"),
        amber:            withOpacity("--color-amber"),
        purple:           withOpacity("--color-purple"),
        emerald:          withOpacity("--color-emerald"),
        rose:             withOpacity("--color-rose"),
      },
      fontFamily: {
        heading: ["Syne_800ExtraBold"],
        body: ["DMSans_400Regular"],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
