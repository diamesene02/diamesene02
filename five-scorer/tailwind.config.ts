import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#f0fdf4",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
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
        // Une seule famille : l'axe de chasse d'Archivo remplace la seconde
        // police. `font-mono` conserve le nom mais pointe la même variable —
        // les chiffres tabulaires y suffisent à aligner les colonnes.
        sans: ["Archivo", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        score: ["4.5rem", { lineHeight: "1", fontWeight: "800" }],
      },
    },
  },
  plugins: [],
};

export default config;
