import type { Meta, StoryObj } from "@storybook/react";
import Button from "./Button";

const meta: Meta<typeof Button> = {
  title: "Design System/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "ghost"],
      description: "Button variant style",
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg"],
      description: "Button size",
    },
    disabled: {
      control: { type: "boolean" },
      description: "Disabled state",
    },
    children: {
      control: { type: "text" },
      description: "Button content",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Individual variants
export const Primary: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    size: "md",
    children: "Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    size: "md",
    children: "Button",
  },
};

// Interactive playground
export const Interactive: Story = {
  args: {
    variant: "primary",
    size: "md",
    children: "Button",
    disabled: false,
  },
};

// Complete Figma matrix - matching the design system
export const FigmaDesignMatrix: Story = {
  render: () => (
    <div
      style={{
        padding: "40px",
        fontFamily: "var(--font-family-base)",
        backgroundColor: "#ffffff",
        border: "2px dashed #6c8158",
        borderRadius: "12px",
      }}
    >
      <h2
        style={{
          margin: "0 0 32px 0",
          fontSize: "24px",
          color: "var(--color-primary)",
          textAlign: "center",
        }}
      >
        🎯 Figma Button Design Matrix
      </h2>

      {/* Size Labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
          gap: "16px",
          marginBottom: "16px",
        }}
      >
        <div></div>
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
          }}
        >
          Default
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
          }}
        >
          Hover
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
          }}
        >
          Pressed
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
          }}
        >
          Disabled
        </div>
      </div>

      {/* Small Size Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
          gap: "16px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
            minWidth: "60px",
          }}
        >
          Small
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="sm">
            Button
          </Button>
          <Button variant="secondary" size="sm">
            Button
          </Button>
          <Button variant="ghost" size="sm">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="sm" className="hover-demo">
            Button
          </Button>
          <Button variant="secondary" size="sm" className="hover-demo">
            Button
          </Button>
          <Button variant="ghost" size="sm" className="hover-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="sm" className="active-demo">
            Button
          </Button>
          <Button variant="secondary" size="sm" className="active-demo">
            Button
          </Button>
          <Button variant="ghost" size="sm" className="active-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="sm" disabled>
            Button
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Button
          </Button>
          <Button variant="ghost" size="sm" disabled>
            Button
          </Button>
        </div>
      </div>

      {/* Medium Size Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
          gap: "16px",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
            minWidth: "60px",
          }}
        >
          Medium
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="md">
            Button
          </Button>
          <Button variant="secondary" size="md">
            Button
          </Button>
          <Button variant="ghost" size="md">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="md" className="hover-demo">
            Button
          </Button>
          <Button variant="secondary" size="md" className="hover-demo">
            Button
          </Button>
          <Button variant="ghost" size="md" className="hover-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="md" className="active-demo">
            Button
          </Button>
          <Button variant="secondary" size="md" className="active-demo">
            Button
          </Button>
          <Button variant="ghost" size="md" className="active-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="md" disabled>
            Button
          </Button>
          <Button variant="secondary" size="md" disabled>
            Button
          </Button>
          <Button variant="ghost" size="md" disabled>
            Button
          </Button>
        </div>
      </div>

      {/* Large Size Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "var(--color-primary)",
            minWidth: "60px",
          }}
        >
          Large
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="lg">
            Button
          </Button>
          <Button variant="secondary" size="lg">
            Button
          </Button>
          <Button variant="ghost" size="lg">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="lg" className="hover-demo">
            Button
          </Button>
          <Button variant="secondary" size="lg" className="hover-demo">
            Button
          </Button>
          <Button variant="ghost" size="lg" className="hover-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="lg" className="active-demo">
            Button
          </Button>
          <Button variant="secondary" size="lg" className="active-demo">
            Button
          </Button>
          <Button variant="ghost" size="lg" className="active-demo">
            Button
          </Button>
        </div>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
          <Button variant="primary" size="lg" disabled>
            Button
          </Button>
          <Button variant="secondary" size="lg" disabled>
            Button
          </Button>
          <Button variant="ghost" size="lg" disabled>
            Button
          </Button>
        </div>
      </div>

      <div
        style={{
          marginTop: "32px",
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          fontSize: "14px",
          color: "#666",
        }}
      >
        ✅ <strong>Extracted from Figma</strong> using MCP servers
        <br />
        🎨 All states match the original design specifications
        <br />
        🔄 Hover and pressed states demonstrate interaction design
      </div>

      <style jsx>{`
        .hover-demo {
          box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25) !important;
        }
        .active-demo {
          box-shadow: 0px 4px 4px 0px inset rgba(0, 0, 0, 0.25) !important;
        }
      `}</style>
    </div>
  ),
};
