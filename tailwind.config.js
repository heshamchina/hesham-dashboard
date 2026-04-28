/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Brand ──────────────────────────────────────────────
        brand: {
          red:         "#A51C1C",
          "red-dark":  "#7D1515",
          "red-dim":   "#A51C1C26",   // 15% opacity for dark bg glow
          gold:        "#D4A017",
          "gold-light":"#E8B820",
          "gold-dim":  "#D4A01726",
          cream:       "#F5EDD8",
        },

        // ── Surface (dark mode base) ───────────────────────────
        surface: {
          base:    "#0F0F0F",   // page background
          panel:   "#1A1A1A",   // card / panel background
          hover:   "#242424",   // hover state on panels
          raised:  "#2A2A2A",   // inputs, selects on dark
          border:  "#2E2E2E",   // subtle border
          "border-bright": "#3A3A3A", // slightly more visible
        },

        // ── Text (dark mode) ───────────────────────────────────
        ink: {
          primary:   "#F0F0F0",   // headings
          secondary: "#A0A0A0",   // secondary text
          muted:     "#606060",   // placeholder, hint
          disabled:  "#404040",
        },

        // ── Semantic status ─────────────────────────────────────
        status: {
          "green-bg":    "#0D2818",
          "green-text":  "#4ADE80",
          "yellow-bg":   "#2A2008",
          "yellow-text": "#FCD34D",
          "red-bg":      "#2A0808",
          "red-text":    "#F87171",
          "blue-bg":     "#081828",
          "blue-text":   "#60A5FA",
          "purple-bg":   "#180A28",
          "purple-text": "#C084FC",
        },
      },

      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },

      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.04em" }],
      },

      borderRadius: {
        "4xl": "2rem",
      },

      transitionDuration: {
        "50":  "50ms",
        "150": "150ms",
      },

      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "dot-bounce": {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.3" },
          "40%":           { transform: "scale(1)",   opacity: "1" },
        },
      },

      animation: {
        fadeUp:      "fadeUp 0.18s ease both",
        fadeIn:      "fadeIn 0.15s ease both",
        slideIn:     "slideIn 0.2s ease both",
        "pulse-slow":"pulse 2s ease-in-out infinite",
        shimmer:     "shimmer 2s linear infinite",
        "dot-1":     "dot-bounce 1.2s ease-in-out 0s infinite",
        "dot-2":     "dot-bounce 1.2s ease-in-out 0.2s infinite",
        "dot-3":     "dot-bounce 1.2s ease-in-out 0.4s infinite",
      },

      boxShadow: {
        "glow-red":  "0 0 20px rgba(165, 28, 28, 0.3)",
        "glow-gold": "0 0 20px rgba(212, 160, 23, 0.25)",
        "panel":     "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "panel-lg":  "0 4px 16px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
}
