import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

test("valuable action schema compatibility smoke", () => {
  const schemaPath = path.join(process.cwd(), "generated", "schema.graphql");
  const indexPath = path.join(process.cwd(), "src", "index.ts");

  expect(fs.existsSync(schemaPath)).toBe(true);
  expect(fs.existsSync(indexPath)).toBe(true);

  const indexFile = fs.readFileSync(indexPath, "utf8");
  expect(indexFile.includes("valuable-actions/readiness")).toBe(true);
  expect(indexFile.includes("ValuableActionRegistry:ValuableActionCreated")).toBe(true);
});
