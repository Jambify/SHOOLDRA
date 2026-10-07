import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          light: "var(--color-brand-light)",
          dim: "var(--color-brand-dim)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          dim: "var(--color-success-dim)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          dim: "var(--color-danger-dim)",
        },
        warn: {
          DEFAULT: "var(--color-warn)",
          dim: "var(--color-warn-dim)",
        },

        /* ── Backgrounds ─────────────────────────── */
        bg: "var(--bg)",
        bgDeep: "var(--bgDeep)",
        bgMain: "var(--bgMain)",
        bgSurface: "var(--bgSurface)",
        bgCard: "var(--bgCard)",

        /* ── Borders ─────────────────────────────── */
        borderMuted: "var(--borderMuted)",

        /* ── Text ────────────────────────────────── */
        textMain: "var(--textMain)",
        textMuted: "var(--textMuted)",
        textDim: "var(--textDim)",
      },

      fontFamily: {
        display: ["Syne", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },

      borderRadius: {
        brand: "12px",
        "brand-lg": "18px",
        "brand-xl": "24px",
      },

      /* ── Animations ──────────────────────────── */
      animation: {
        fadeIn: "fadeIn 0.25s ease both",
        slideDown: "slideDown 0.2s ease both",
        spin: "spin 0.75s linear infinite",
        pulse: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },

      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".5" },
        },
      },

      /* ── Box shadows ─────────────────────────── */
      boxShadow: {
        brand: "var(--shadow-brand-val)",
        success: "var(--shadow-success-val)",
        danger: "var(--shadow-danger-val)",
        card: "var(--shadow-card-val)",
      },
    },
  },
  plugins: [],
} satisfies Config;
