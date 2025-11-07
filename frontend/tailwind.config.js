// tailwind.config.js (ESM)
import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          400: "#22D3EE",   // light cyan
          500: "#06B6D4",   // primary cyan
          600: "#0891B2",   // darker cyan
          DEFAULT: "#06B6D4",
        },
      },
      fontFamily: {
        // @fontsource-variable/inter používá název "InterVariable"
        sans: ["InterVariable", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
