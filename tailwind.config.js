/** Tema baseado na "Apresentação Padrão" PMMG: preto, dourado, creme e fonte Rawline. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        pm: {
          black: "#0B0B0C",
          ink: "#231F20",
          gold: "#9B8A5C",
          "gold-dark": "#7A6C45",
          "gold-light": "#CFC29B",
          cream: "#F3F0E7",
          sand: "#E9E4D6",
          line: "#D8D0BA",
          muted: "#6B655A",
          red: "#B3261E",
        },
        status: {
          todo: "#2F5D7C",
          late: "#B3261E",
          paused: "#5F5E5A",
          risk: "#C28A12",
          done: "#2E6B3A",
        },
      },
      fontFamily: {
        sans: ["Rawline", "Raleway", "system-ui", "sans-serif"],
        display: ["Rawline", "Raleway", "system-ui", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(35,31,32,.04), 0 10px 30px -18px rgba(35,31,32,.35)",
      },
    },
  },
  plugins: [],
};
