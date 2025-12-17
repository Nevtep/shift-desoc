import type { Meta, StoryObj } from "@storybook/react";
import GettingStarted from "./GettingStarted";

const meta: Meta<typeof GettingStarted> = {
  title: "Landing/Getting Started",
  component: GettingStarted,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof GettingStarted>;

export const Default: Story = {};
