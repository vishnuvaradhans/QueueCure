import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        clinic: {
          blue: "#0f8edb",
          navy: "#12324a",
          mint: "#1dbf9f",
          green: "#16a269",
          red: "#dc2626",
          surface: "#f7fbfd",
        },
      },
      boxShadow: {
        card: "0 28px 70px rgba(18, 50, 74, 0.16)",
        soft: "0 14px 35px rgba(15, 142, 219, 0.14)",
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseLine: {
          "0%, 100%": { opacity: "0.45", transform: "scaleX(0.85)" },
          "50%": { opacity: "1", transform: "scaleX(1)" },
        },
      },
      animation: {
        floatIn: "floatIn 650ms ease-out both",
        pulseLine: "pulseLine 1800ms ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
