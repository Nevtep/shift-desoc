import type { Meta, StoryObj } from "@storybook/react";
import Future from "./Future";

const meta: Meta<typeof Future> = {
  title: "Landing/Future",
  component: Future,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Future>;

export const Default: Story = {};
