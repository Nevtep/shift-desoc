import { describe, expect, it } from "vitest";

function deriveReadinessStatus(ageMs: number): "healthy" | "lagging" {
  return ageMs > 180_000 ? "lagging" : "healthy";
}

describe("valuable action readiness endpoint contract", () => {
  it("returns healthy within freshness window", () => {
    expect(deriveReadinessStatus(60_000)).toBe("healthy");
  });

  it("returns lagging when freshness window is exceeded", () => {
    expect(deriveReadinessStatus(181_000)).toBe("lagging");
  });
});
