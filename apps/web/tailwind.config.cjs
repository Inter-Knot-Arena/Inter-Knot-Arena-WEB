/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ika: {
          900: "#070d16",
          800: "#101c2a",
          700: "#182738",
          600: "#20344a"
        },
        ink: {
          900: "#f5f8ff",
          700: "#c8d3e5",
          500: "#7f8ea7"
        },
        accent: {
          600: "#e1682f",
          500: "#f79b4f",
          400: "#ffd08a"
        },
        cool: {
          500: "#2b9db3",
          400: "#83d1df"
        },
        border: "rgba(163, 182, 210, 0.22)"
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        sans: ["Manrope", "sans-serif"]
      },
      boxShadow: {
        card: "0 18px 38px rgba(0, 0, 0, 0.42)"
      }
    }
  },
  plugins: []
};
