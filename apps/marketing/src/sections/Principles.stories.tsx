import type { Meta, StoryObj } from "@storybook/react";
import Principles from "./Principles";

const meta: Meta<typeof Principles> = {
  title: "Landing/Principles",
  component: Principles,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Principles>;

export const Default: Story = {};
