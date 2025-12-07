import type { Preview } from "@storybook/nextjs";
// Import design tokens
import "../src/styles/tokens.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "#e8e6e0" },
        { name: "white", value: "#ffffff" },
        { name: "primary", value: "#6c8158" },
      ],
    },
  },
};
export default preview;
