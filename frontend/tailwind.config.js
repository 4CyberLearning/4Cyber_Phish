// tailwind.config.js (ESM)
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["InterVariable", ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        glass: "0 30px 80px rgba(15,23,42,0.14)",
        soft: "0 10px 30px rgba(15,23,42,0.12)",
      },
      borderRadius: {
        "4xl": "28px",
      },
    },
  },
  plugins: [],
};
