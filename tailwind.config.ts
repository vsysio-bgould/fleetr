import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // EVE-inspired dark palette
        "fleet-bg": "hsl(var(--fleet-bg) / <alpha-value>)",
        "fleet-surface": "hsl(var(--fleet-surface) / <alpha-value>)",
        "fleet-border": "hsl(var(--fleet-border) / <alpha-value>)",
        "fleet-accent": "hsl(var(--fleet-accent) / <alpha-value>)",
        "fleet-muted": "hsl(var(--fleet-muted) / <alpha-value>)",
        "fleet-text": "hsl(var(--fleet-text) / <alpha-value>)",
        "fleet-text-muted": "hsl(var(--fleet-text-muted) / <alpha-value>)",
        "battle-accent": "hsl(var(--battle-accent) / <alpha-value>)",
        "cruise-accent": "hsl(var(--cruise-accent) / <alpha-value>)",
      },
    },
  },
  plugins: [],
};

export default config;
