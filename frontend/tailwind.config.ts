import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-soft": "var(--accent-soft)",
        primary: "var(--primary)",
        "primary-focus": "var(--primary-focus)",
        hairline: "var(--hairline)",
        "divider-soft": "var(--divider-soft)",
        ink: "var(--ink)",
        "ink-muted-80": "var(--ink-muted-80)",
        "ink-muted-48": "var(--ink-muted-48)",
        canvas: "var(--canvas)",
        parchment: "var(--canvas-parchment)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Inter"',
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          "ui-monospace",
          "monospace",
        ],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",   // Apple cards, dialogs, sheets
        xl: "20px",   // Large hero surfaces
        pill: "9999px", // CTAs, search, filter chips
      },
      fontWeight: {
        normal: "400",
        semibold: "600",
        bold: "700",
      },
    },
  },
  plugins: [],
};
export default config;
