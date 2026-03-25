import { expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

test("schema-compatibility-smoke: keeps generated GraphQL schema and core query surfaces available", () => {
    const schemaPath = path.join(process.cwd(), "generated", "schema.graphql");
    const readmePath = path.join(process.cwd(), "README.md");

    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(readmePath)).toBe(true);

    const schema = fs.readFileSync(schemaPath, "utf8");
    expect(schema.includes("type Query")).toBe(true);
    expect(schema.includes("communities")).toBe(true);
    expect(schema.includes("requests")).toBe(true);
    expect(schema.includes("proposals")).toBe(true);
});
