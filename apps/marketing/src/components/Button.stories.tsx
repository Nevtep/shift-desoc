import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta = {
  title: 'Design System/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Button component based on Figma design system with primary, secondary, and ghost variants in small, medium, and large sizes.'
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'radio' },
      options: ['primary', 'secondary', 'ghost'],
    },
    size: {
      control: { type: 'radio' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    children: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'md', 
    children: 'Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    size: 'md',
    children: 'Button',
  },
};

// Size variants
export const Small: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Small Button',
  },
};

export const Medium: Story = {
  args: {
    variant: 'primary', 
    size: 'md',
    children: 'Medium Button',
  },
};

export const Large: Story = {
  args: {
    variant: 'primary',
    size: 'lg', 
    children: 'Large Button',
  },
};

// States
export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'md',
    disabled: true,
    children: 'Disabled Button',
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4 flex-wrap">
      <div className="flex flex-col gap-2 items-center">
        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>Primary</h3>
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="md">Medium</Button> 
        <Button variant="primary" size="lg">Large</Button>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>Secondary</h3>
        <Button variant="secondary" size="sm">Small</Button>
        <Button variant="secondary" size="md">Medium</Button>
        <Button variant="secondary" size="lg">Large</Button>
      </div>
      <div className="flex flex-col gap-2 items-center">
        <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-primary)' }}>Ghost</h3>
        <Button variant="ghost" size="sm">Small</Button>
        <Button variant="ghost" size="md">Medium</Button>
        <Button variant="ghost" size="lg">Large</Button>
      </div>
    </div>
  ),
};