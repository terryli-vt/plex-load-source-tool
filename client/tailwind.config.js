/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      screens: {
        custom: "780px", // Custom breakpoint
      },
    },
  },
  plugins: [require("daisyui")],
};
