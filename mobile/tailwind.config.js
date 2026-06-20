/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "#13131A",
        card: "#1C1C27",
        accent: "#6C63FF",
        "accent-2": "#00D4AA",
        danger: "#FF4F6E",
        "text-primary": "#F0F0F5",
        "text-secondary": "#8888A0",
        border: "#2A2A3A",
      },
    },
  },
  plugins: [],
};
