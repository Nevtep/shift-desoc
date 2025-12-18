import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const colors = {
  background: "#F5F5E8",
  backgroundLight: "#FAFAF5",
  text: "#2C2C2C",
  textMedium: "#4A4A4A",
  primary: "#4CAF50",
  primaryDark: "#388E3C",
  secondary: "#FF9800",
  secondaryDark: "#F57C00",
  accent: "#2196F3",
  grey: {
    light: "#E0E0D0",
    medium: "#8B8B7A"
  },
  white: "#FFFFFF"
} as const;

const spacing = {
  0: "0px",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  7: "1.75rem",
  8: "2rem",
  9: "2.25rem",
  10: "2.5rem",
  12: "3rem",
  14: "3.5rem",
  16: "4rem",
  20: "5rem"
} as const;

const radius = {
  0: "0px",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem"
} as const;

const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.75rem",
  "4xl": "2rem",
  "5xl": "2.25rem",
  "6xl": "2.5rem",
  "7xl": "3rem",
  "8xl": "3.5rem"
} as const;

export const tailwindPreset: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: colors.background,
        backgroundLight: colors.backgroundLight,
        foreground: colors.text,
        text: colors.text,
        textMedium: colors.textMedium,
        primary: colors.primary,
        primaryDark: colors.primaryDark,
        secondary: colors.secondary,
        secondaryDark: colors.secondaryDark,
        accent: colors.accent,
        grey: colors.grey,
        white: colors.white
      },
      spacing,
      borderRadius: {
        none: radius[0],
        xs: radius[1],
        sm: radius[2],
        md: radius[3],
        lg: radius[4]
      },
      maxWidth: {
        container: "1200px"
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif"
        ]
      },
      fontSize
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": {
          "--radius": radius[3], // matches shared medium rounding token
          "--radius-xs": radius[1],
          "--radius-sm": radius[2],
          "--radius-lg": radius[4]
        }
      });
    })
  ]
};
