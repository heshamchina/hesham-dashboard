/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#A51C1C", "red-dark": "#7D1515",
          gold: "#D4A017", "gold-light": "#E8B820",
          cream: "#F5EDD8",
        },
      },
    },
  },
  plugins: [],
}
