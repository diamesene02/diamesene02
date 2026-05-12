import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand action color — was green (team A on the old web), now amber
        // to match the "Terrain" mobile palette. Used for focus rings + primary
        // CTAs (PIN gate, new match form, MVP picker).
        pitch: {
          50:  "#FFF5DC",
          400: "#FFB84D",
          500: "#F9A825",
          600: "#E0931F",
          700: "#B57717",
          800: "#8B5C12",
          900: "#1F1500",
        },
        ink: {
          0: "var(--ink-0)",
          1: "var(--ink-1)",
          2: "var(--ink-2)",
        },
        bg: {
          0: "var(--bg-0)",
          1: "var(--bg-1)",
          2: "var(--bg-2)",
        },
      },
      fontFamily: {
        sans: ["Archivo", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        score: ["4.5rem", { lineHeight: "1", fontWeight: "800" }],
      },
    },
  },
  plugins: [],
};

export default config;
