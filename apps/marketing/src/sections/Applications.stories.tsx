import type { Meta, StoryObj } from "@storybook/react";
import Applications from "./Applications";

const meta: Meta<typeof Applications> = {
  title: "Landing/Applications",
  component: Applications,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof Applications>;

export const Default: Story = {};
