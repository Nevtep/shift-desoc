import type { Preview } from "@storybook/react";
// importa tokens/theme globales del marketing site:
import "../src/styles/tokens.css";
import "../src/styles/globals.css";

// (opcional) backgrounds por defecto
const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: "centered",
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "var(--color-surface, #e8e6e0)" },
        { name: "light", value: "#ffffff" }
      ]
    },
    a11y: { element: "#root", manual: false },
  },
};
export default preview;
