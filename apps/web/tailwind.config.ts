import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  // No darkMode toggle needed — we use data-theme attribute + CSS variables
  theme: {
    extend: {
      colors: {
        // All resolved via CSS custom properties — switch theme with [data-theme]
        bg:       "var(--bg)",
        card:     "var(--card)",
        sidebar:  "var(--sidebar)",
        text:     "var(--text)",
        muted:    "var(--muted)",
        border:   "var(--border)",
        accent:   "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        good:     "var(--good)",
        warn:     "var(--warn)",
        bad:      "var(--bad)",
        // featured KPI card (dark in both themes)
        feat:     "var(--feat)",
        "feat-text": "var(--feat-text)",
        // sidebar-specific tokens (adapt to theme)
        "sidebar-fg":     "var(--sidebar-fg)",
        "sidebar-muted":  "var(--sidebar-muted)",
        "sidebar-border": "var(--sidebar-border)",
        "sidebar-chip":   "var(--sidebar-chip)",
        "sidebar-hover":  "var(--sidebar-hover)",
      },
      fontFamily: {
        sans:    ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
