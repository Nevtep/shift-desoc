import type { Meta, StoryObj } from "@storybook/react";
import Features from "./Features";

const meta: Meta<typeof Features> = {
  title: "Landing/Features",
  component: Features,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Features>;

export const Default: Story = {};
