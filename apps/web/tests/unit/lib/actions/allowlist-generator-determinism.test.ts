import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../../../../../");

const PROFILE_PATH = path.join(ROOT, "apps/web/lib/actions/allowlists/base-sepolia-v1.json");
const META_PATH = path.join(ROOT, "apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json");

function runGenerator() {
  execFileSync(
    "pnpm",
    ["exec", "ts-node", "--esm", "scripts/generate-draft-composer-allowlist.ts"],
    { cwd: ROOT, stdio: "pipe" }
  );
}

describe("allowlist generator determinism", () => {
  it("emits byte-identical allowlist artifacts across two runs", async () => {
    runGenerator();
    const firstProfile = await readFile(PROFILE_PATH, "utf8");
    const firstMeta = await readFile(META_PATH, "utf8");

    runGenerator();
    const secondProfile = await readFile(PROFILE_PATH, "utf8");
    const secondMeta = await readFile(META_PATH, "utf8");

    expect(secondProfile).toBe(firstProfile);
    expect(secondMeta).toBe(firstMeta);
  });
});
