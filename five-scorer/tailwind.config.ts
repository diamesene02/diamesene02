import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "var(--ink-0)",
          1: "var(--ink-1)",
          2: "var(--ink-2)",
        },
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
          paper: "var(--bg-paper)",
        },
        amber: {
          DEFAULT: "var(--amber)",
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Geist"', "-apple-system", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
