import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = path.resolve(__dirname, "../../../..");
const bundleDir = path.join(webRoot, "lib/deploy/bundled-contracts");
const executorPath = path.join(webRoot, "lib/deploy/factory-step-executor.ts");

const EXPECTED_CONTRACTS = [
  "GovernanceLayerFactory",
  "VerificationLayerFactory",
  "EconomicLayerFactory",
  "CommerceLayerFactory",
  "CoordinationLayerFactory",
  "MembershipTokenERC20Votes",
  "ShiftTimelockController",
  "ShiftGovernor",
  "CountingMultiChoice",
  "VerifierPowerToken1155",
  "VerifierElection",
  "VerifierManager",
  "ValuableActionRegistry",
  "ValuableActionSBT",
  "Engagements",
  "PositionManager",
  "CredentialManager",
  "CohortRegistry",
  "InvestmentCohortManager",
  "RevenueRouter",
  "CommunityToken",
  "TreasuryAdapter",
  "CommerceDisputes",
  "Marketplace",
  "HousingManager",
  "ProjectFactory",
  "RequestHub",
  "DraftsManager",
  "ShiftAccessManager",
];

describe("deploy artifacts bundle", () => {
  it("does not import the gitignored root Hardhat artifacts directory", () => {
    const source = fs.readFileSync(executorPath, "utf8");
    expect(source).not.toMatch(/artifacts\/contracts\//);
  });

  it.each(EXPECTED_CONTRACTS)("bundles abi and creation code for %s", (name) => {
    const file = path.join(bundleDir, `${name}.json`);
    expect(fs.existsSync(file)).toBe(true);

    const artifact = JSON.parse(fs.readFileSync(file, "utf8")) as {
      contractName: string;
      abi: unknown;
      bytecode: string;
    };
    expect(artifact.contractName).toBe(name);
    expect(Array.isArray(artifact.abi)).toBe(true);
    expect(artifact.bytecode).toMatch(/^0x[0-9a-f]{2,}$/);
  });
});
