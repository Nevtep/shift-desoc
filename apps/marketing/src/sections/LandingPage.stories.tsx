import type { Meta, StoryObj } from "@storybook/react";
import LandingPage from "../app/LandingPage";

const meta: Meta<typeof LandingPage> = {
  title: "Landing/Page",
  component: LandingPage,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof LandingPage>;

export const Default: Story = {
  args: {
    onLanguageChange: async () => Promise.resolve(),
  },
};
