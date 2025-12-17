import type { Meta, StoryObj } from "@storybook/react";
import Vision from "./Vision";

const meta: Meta<typeof Vision> = {
  title: "Landing/Vision",
  component: Vision,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Vision>;

export const Default: Story = {};
