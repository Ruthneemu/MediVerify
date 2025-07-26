/** @type {import('tailwindcss').Config} */
module.exports = {
  // This tells Tailwind to scan all .js, .jsx, .ts, .tsx files in the src/ directory
  // for Tailwind class names to include in the final CSS.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // You can extend Tailwind's default theme here.
      // For example, adding a custom font family:
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Ensure 'Inter' is loaded via CSS or HTML
      },
    },
  },
  plugins: [],
}
