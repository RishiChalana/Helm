/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // ── Base surfaces (forest-dark palette from DESIGN.md) ──────
        background: "#0e1511",
        surface: "#1a211d",
        card: "#161d19",
        panel: "#242c27",

        // ── Typography ──────────────────────────────────────────────
        "text-primary": "#dde4dd",
        "text-secondary": "#bbcac0",
        "text-dim": "#85948b",
        "text-inverse": "#2b322e",

        // ── Semantic accents ────────────────────────────────────────
        emerald: "#5af0b3",
        "emerald-dim": "#45dfa4",
        gold: "#dcc66e",
        coral: "#ffb4ab",

        // ── Borders (low-opacity forest green) ──────────────────────
        border: "#2f3632",
        "border-hi": "#3c4a42",

        // ── Backward-compat aliases (existing screens unchanged) ────
        accent: "#5af0b3",
        "accent-2": "#dcc66e",
        danger: "#ffb4ab",
      },
      fontFamily: {
        serif: ["PlayfairDisplay_400Regular"],
        "serif-medium": ["PlayfairDisplay_500Medium"],
        "serif-bold": ["PlayfairDisplay_700Bold"],
        sans: ["Geist_300Light"],
        "sans-medium": ["Geist_500Medium"],
        "sans-semibold": ["Geist_600SemiBold"],
        mono: ["Geist_400Regular"],
      },
      fontSize: {
        display: [36, { lineHeight: 43 }],
        headline: [24, { lineHeight: 31 }],
        "body-lg": [18, { lineHeight: 29 }],
        body: [16, { lineHeight: 24 }],
        label: [11, { lineHeight: 16 }],
        data: [14, { lineHeight: 20 }],
      },
      borderRadius: {
        none: 0,
        sm: 2,
        DEFAULT: 4,
        md: 6,
        lg: 8,
        xl: 12,
        "2xl": 16,
        "3xl": 24,
        full: 9999,
      },
    },
  },
  plugins: [],
};
