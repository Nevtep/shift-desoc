# Shift Marketing Site - AI Development Guidelines

## Architecture Overview
This is a Next.js 14 App Router marketing site for Shift, a decentralized governance platform. The project follows a component-driven architecture with Storybook for development and design system documentation.

## Key Patterns & Conventions

### Design System Integration
- **Design tokens**: All design values are centralized in `src/styles/tokens.css` using CSS custom properties
- **Component structure**: Components follow the pattern: `Component.tsx` + `Component.module.css` + `Component.stories.tsx`
- **CSS Modules**: Use CSS Modules with design token variables for styling (e.g., `var(--color-primary)`, `var(--space-16)`)

### Component Development
- **Storybook-first**: Develop components in isolation with comprehensive stories
- **Interface exports**: Always export component props interfaces (e.g., `ButtonProps`)
- **Variant patterns**: Use discriminated unions for variants (`variant?: "primary" | "secondary" | "ghost"`)
- **Default props**: Provide sensible defaults in destructuring (`variant = "primary"`)

### File Structure
```
src/
├── app/                    # Next.js App Router pages
├── components/            # Reusable components
└── styles/tokens.css      # Design system tokens
```

## Development Workflow

### Commands
- `npm run dev` - Start Next.js development server
- `npm run storybook` - Start Storybook on port 6006
- `npm run build-storybook` - Build Storybook for deployment

### Storybook Configuration
- Stories location: `src/components/**/*.stories.tsx`
- Auto-generates documentation with `tags: ["autodocs"]`
- Includes design token CSS in preview
- Custom backgrounds match design system colors

## Spanish Content Context
The site is in Spanish targeting Latin American communities. Key product concepts:
- **Acciones Valorable**: Verifiable work claims system
- **Token Comunitario**: 1:1 backed community tokens
- **Gobernanza On-Chain**: Multi-option voting governance

## Component Patterns

### Button Component Example
```tsx
// Always export props interface
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  // ... other props
}

// Use CSS Modules with design tokens
import styles from './Button.module.css';

// Provide defaults in destructuring
export default function Button({ 
  variant = "primary", 
  size = "sm",
  // ...
}: ButtonProps) {
  // Build className arrays for variants
  const classes = [
    styles.button,
    styles[variant],
    styles[size]
  ].filter(Boolean).join(' ');
}
```

### Story Structure
```tsx
// Group components by category
const meta: Meta<typeof Component> = {
  title: "Design System/Component", // or "Components/Component"
  component: Component,
  tags: ["autodocs"],
  parameters: {
    designs: [{ // Link to Figma designs when available
      type: "figma",
      url: "https://www.figma.com/file/..."
    }]
  }
};
```

## Quick Start for New Features
1. Create component with TypeScript interface
2. Style with CSS Modules using design tokens
3. Write Storybook stories for all variants
4. Import and use in App Router pages
5. Test in both Storybook and Next.js dev server