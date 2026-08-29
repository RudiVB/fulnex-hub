/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#0c0d0f",
        panel: "#141619",
        panel2: "#1a1d21",
        line: "#26292e",
        ink: "#e8e6e1",
        mute: "#8f939a",
        faint: "#5c6067",
        brass: "#c9a44c",
        brassdim: "#8a7136",
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
