/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        avax: {
          red: "#E84142",
          dark: "#121214",
          card: "#18181B",
          border: "#27272A",
        },
      },
    },
  },
  plugins: [],
};
