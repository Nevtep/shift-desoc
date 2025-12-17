import type { Meta, StoryObj } from "@storybook/react";
import LanguageSelector from "./LanguageSelector";

const meta: Meta<typeof LanguageSelector> = {
  title: "Landing/Language Selector",
  component: LanguageSelector,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof LanguageSelector>;

export const Default: Story = {
  args: {
    onLanguageChange: async () => Promise.resolve(),
  },
};
