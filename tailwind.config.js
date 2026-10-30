/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: "#12372A",
        green: { DEFAULT: "#2F7D32", dark: "#1F5F24", tint: "#E2EEDC" },
        leaf: "#3E9B4B",
        lime: "#9BCB3C",
        tomato: { DEFAULT: "#C64B22", dark: "#9A3512", tint: "#FAE4DA" },
        amber: { DEFAULT: "#D9970F", dark: "#6E4B00", tint: "#FBEFCF" },
        surface: "#F1F5EE",
        ink: "#1D2B22",
        muted: "#5B6B61",
        line: "#D5E0CF",
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Telugu", "Noto Sans Kannada", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Noto Sans Telugu", "Noto Sans Kannada", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: { soft: "0 8px 24px rgba(18,55,42,.08)" },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [],
};
