import { describe, expect, it } from "vitest";

import { formatModuleAddress } from "../../../lib/community-overview/formatters";

describe("community overview address formatter", () => {
  it("formats valid addresses as 0x1234...abcd", () => {
    expect(formatModuleAddress("0x1234567890abcdef1234567890abcdef1234abcd")).toBe("0x1234...abcd");
  });

  it("returns unavailable for invalid or empty address", () => {
    expect(formatModuleAddress("")).toBe("unavailable");
    expect(formatModuleAddress(null)).toBe("unavailable");
    expect(formatModuleAddress("0x1234")).toBe("unavailable");
  });
});
