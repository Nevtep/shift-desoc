import type { Meta, StoryObj } from "@storybook/react";
import Impact from "./Impact";

const meta: Meta<typeof Impact> = {
  title: "Landing/Impact",
  component: Impact,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Impact>;

export const Default: Story = {};
