import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        monex: "#0b2545",        // azul Monex (franja superior)
        monexHover: "#0f2e55",
        accent: "#0b2545",        // acento primario = azul Monex
      },
    },
  },
  plugins: [],
};

export default config;
