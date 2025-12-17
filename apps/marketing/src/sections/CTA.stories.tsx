import type { Meta, StoryObj } from "@storybook/react";
import CTA from "./CTA";

const meta: Meta<typeof CTA> = {
  title: "Landing/CTA",
  component: CTA,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof CTA>;

export const Default: Story = {};
