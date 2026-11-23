import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wizard = readFileSync(resolve(__dirname, "../../../components/home/deploy-wizard.tsx"), "utf8");
const css = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");

describe("deploy wizard readability over the background illustration", () => {
  it("defines a solid cream secondary button", () => {
    expect(css).toMatch(/\.btn-cream\s*\{/);
    expect(css).toMatch(/246,\s*240,\s*225/);
  });

  it("uses the cream button for every secondary action inside the wizard overlay", () => {
    expect(wizard).not.toMatch(/className="btn-ghost/);
    const cream = wizard.match(/btn-cream/g) ?? [];
    expect(cream.length).toBeGreaterThanOrEqual(4);
  });

  it("puts a contrast overlay between the illustration and the wizard content", () => {
    expect(wizard).toContain("data-testid=\"wizard-contrast-overlay\"");
  });
});
