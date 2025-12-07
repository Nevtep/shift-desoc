import type { Meta, StoryObj } from "@storybook/react";
import Hero from "./Hero";

const meta: Meta<typeof Hero> = {
  title: "Components/Hero",
  component: Hero,
  tags: ["autodocs"], // genera Docs automáticamente
  argTypes: {
    layout: {
      control: { type: "radio" },
      options: ["left", "center", "split"],
    },
  },
  parameters: {
    designs: [
      {
        type: "figma",
        name: "Figma — Hero",
        url: "https://www.figma.com/file/XXXXX/Shift-Marketing?node-id=YYY", // link al nodo
      },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Hero>;
export const Center: Story = {
  args: {
    title: "Shift — Together We Rise",
    subtitle: "Comunidades on-chain: acciones valorables, economía 1:1",
    ctaLabel: "Comenzar",
    layout: "center",
  },
};
export const Split: Story = {
  args: { ...Center.args, layout: "split" },
};
