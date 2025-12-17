import type { Meta, StoryObj } from "@storybook/react";
import WhyBlockchain from "./WhyBlockchain";

const meta: Meta<typeof WhyBlockchain> = {
  title: "Landing/Why Blockchain",
  component: WhyBlockchain,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof WhyBlockchain>;

export const Default: Story = {};
