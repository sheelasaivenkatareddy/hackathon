/** @type {import('tailwindcss').Config} */
// One theme for the whole site: deep navy with cyan/teal accents (the Kisan Hub look).
// Every brand colour is a CSS variable (src/index.css), so pages written for the old light theme switch with it.
// The pairs keep their contrast: bg-white cards become navy, text-forest headings become near-white,
// bg-green buttons become cyan with navy text.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("white"),
        forest: v("forest"),
        green: { DEFAULT: v("green"), dark: v("green-dark"), tint: v("green-tint") },
        leaf: v("leaf"),
        lime: v("lime"),
        tomato: { DEFAULT: v("tomato"), dark: v("tomato-dark"), tint: v("tomato-tint") },
        amber: { DEFAULT: v("amber"), dark: v("amber-dark"), tint: v("amber-tint") },
        surface: v("surface"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        deep: "#040A18", // dark panels (footer, photo frames, summary cards, overlays); pair with the "lit" class
        // Kisan Hub (dark, neon)
        navy: { 950: "#040A18", 900: "#081226", 800: "#0E1C38", 700: "#16284B" },
        neon: { cyan: "#22D3EE", teal: "#2DD4BF", lime: "#A3E635", pink: "#F472B6", amber: "#FBBF24", red: "#F87171" },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Kannada", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans Kannada", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "16px" },
      boxShadow: { soft: "0 10px 30px rgba(0, 0, 0, 0.35)" },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [],
};
