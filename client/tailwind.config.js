export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        brand: {
          50: "#eef8ff",
          100: "#d8efff",
          500: "#1688d1",
          600: "#0f6fb0",
          700: "#105b8d"
        }
      },
      boxShadow: {
        soft: "0 18px 50px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
