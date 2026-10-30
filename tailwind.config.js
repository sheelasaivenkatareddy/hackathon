/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#0B2B33",
        green: { DEFAULT: "#0F766E", dark: "#115E59", tint: "#DDF5F0" },
        leaf: "#14B8A6",
        lime: "#FBBF24",
        tomato: { DEFAULT: "#E11D48", dark: "#9F1239", tint: "#FFE4E6" },
        amber: { DEFAULT: "#D97706", dark: "#92400E", tint: "#FEF3C7" },
        surface: "#F6F8FA",
        ink: "#0F172A",
        muted: "#475569",
        line: "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Telugu", "Noto Sans Kannada", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Noto Sans Telugu", "Noto Sans Kannada", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: { soft: "0 8px 24px rgba(11, 43, 51,.08)" },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [],
};
