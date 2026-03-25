import { expect, test } from "vitest";

import { validateStartupEnv } from "../../src/discovery/startup-env";

test("startup-env-fail-fast: fails when required env vars are missing", () => {
  expect(() => validateStartupEnv({ network: "base_sepolia" })).toThrow(
    "Missing required env COMMUNITY_REGISTRY_ADDRESS"
  );
});

test("startup-env-fail-fast: fails for malformed registry address", () => {
  expect(() =>
    validateStartupEnv({
      network: "base_sepolia",
      communityRegistryAddressRaw: "0x123",
      communityRegistryStartBlockRaw: "1",
    })
  ).toThrow("Invalid COMMUNITY_REGISTRY_ADDRESS format");
});

test("startup-env-fail-fast: fails for invalid start block", () => {
  expect(() =>
    validateStartupEnv({
      network: "base_sepolia",
      communityRegistryAddressRaw: "0x1111111111111111111111111111111111111111",
      communityRegistryStartBlockRaw: "-3",
    })
  ).toThrow("Invalid COMMUNITY_REGISTRY_START_BLOCK");
});
