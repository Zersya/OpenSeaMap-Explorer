/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'sea-blue': '#1e3a8a',
        'sea-light': '#93c5fd',
        'sea-dark': '#0f172a',
      },
      zIndex: {
        'map-controls': 1000,
        'map-popups': 1100,
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
