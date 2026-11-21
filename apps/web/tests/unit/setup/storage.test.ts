import { describe, expect, it } from "vitest";

describe("unit test setup storage", () => {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    it(`installs a working ${name} on globalThis`, () => {
      const storage = globalThis[name];
      expect(storage).toBeDefined();
      storage.clear();
      storage.setItem("k", "v");
      expect(storage.getItem("k")).toBe("v");
      expect(storage.length).toBe(1);
      storage.clear();
      expect(storage.getItem("k")).toBeNull();
    });

    it(`${name} is the same object window sees`, () => {
      expect(window[name]).toBe(globalThis[name]);
    });
  }
});
