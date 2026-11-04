/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#073B2C",
        green: { DEFAULT: "#047857", dark: "#065F46", tint: "#D9F2E6" },
        leaf: "#10B981",
        lime: "#E3B04B",
        tomato: { DEFAULT: "#B94A2C", dark: "#8E3419", tint: "#F8E3DA" },
        amber: { DEFAULT: "#D97706", dark: "#92400E", tint: "#FEF3C7" },
        surface: "#F6F2EA",
        ink: "#1C2B24",
        muted: "#55625B",
        line: "#E6DFD1",
        // Kisan Hub (dark, neon)
        navy: { 950: "#040A18", 900: "#081226", 800: "#0E1C38", 700: "#16284B" },
        neon: { cyan: "#22D3EE", teal: "#2DD4BF", lime: "#A3E635", pink: "#F472B6", amber: "#FBBF24", red: "#F87171" },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Kannada", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Kannada", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: { soft: "0 8px 24px rgba(7, 59, 44,.08)" },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [],
};
