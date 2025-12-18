import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export const tailwindPreset: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: {
          DEFAULT: "hsl(210 16% 92%)",
          foreground: "hsl(215 16% 47%)"
        }
      }
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": {
          "--radius": "0.5rem"
        }
      });
    })
  ]
};
