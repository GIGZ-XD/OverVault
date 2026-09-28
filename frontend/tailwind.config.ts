import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", surface: "var(--surface)", "surface-2": "var(--surface-2)",
        border: "var(--border)", text: "var(--text)", muted: "var(--text-muted)",
        accent: "var(--accent)", "accent-soft": "var(--accent-soft)",
        success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: { sm: "6px", md: "10px", lg: "16px" },
    },
  },
  plugins: [],
};
export default config;
