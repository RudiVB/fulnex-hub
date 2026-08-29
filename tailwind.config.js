/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#08090a",
        panel: "#0e0f11",
        panel2: "#141518",
        line: "#1b1d20",
        ink: "#f4f3f0",
        mute: "#9a9c9e",
        faint: "#5e6165",
        brass: "#dddcd5",
        brassdim: "#757672",
        ok: "#4ade80",
        danger: "#e24b4a",
      },
      fontFamily: {
        display: ["Michroma", "sans-serif"],
        body: ["'Hanken Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
