/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand — scholarly indigo with a teal accent (matches web app DNA)
        primary: {
          DEFAULT: "#4F46E5",
          soft: "#EEF2FF",
          hover: "#4338CA",
          muted: "#818CF8",
        },
        accent: {
          DEFAULT: "#0D9488",
          soft: "#CCFBF1",
        },
        surface: "#FFFFFF",
        canvas: "#F8FAFC",
        ink: "#0F172A",
        "ink-secondary": "#475569",
        "ink-muted": "#94A3B8",
        line: "#E2E8F0",
        danger: {
          DEFAULT: "#E11D48",
          soft: "#FFF1F2",
        },
        success: {
          DEFAULT: "#059669",
          soft: "#ECFDF5",
        },
        warning: {
          DEFAULT: "#D97706",
          soft: "#FFFBEB",
        },
      },
      fontFamily: {
        display: ["System"],
        sans: ["System"],
      },
      borderRadius: {
        card: "16px",
        "card-sm": "12px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)",
        elevated:
          "0 10px 25px -5px rgba(15, 23, 42, 0.10), 0 4px 10px -6px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};
