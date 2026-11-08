/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1B3675"
        },
        kiri: {
          cream: "#FFFBF5",
          orange: "#E86F2C",
          amber: "#F59E0B",
          maroon: "#5C0620",
          navy: "#1B3675"
        }
      }
    }
  },
  plugins: []
};
