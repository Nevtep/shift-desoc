import type { Config } from "tailwindcss";
import { tailwindPreset } from "../../packages/ui/src/tailwind-preset";

const config: Config = {
  presets: [tailwindPreset],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/shared/src/**/*.{ts,tsx}"
  ]
};

export default config;
