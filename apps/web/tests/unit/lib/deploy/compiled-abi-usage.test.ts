import fs from "node:fs";
import path from "node:path";

import { decodeFunctionData, encodeFunctionData, toFunctionSelector, type Abi } from "viem";
import { describe, expect, it, vi } from "vitest";

import communityRegistryArtifact from "../../../../abis/CommunityRegistry.json";
import paramControllerArtifact from "../../../../abis/ParamController.json";
import { createFactoryDeployStepExecutor } from "../../../../lib/deploy/factory-step-executor";

const webRoot = path.resolve(__dirname, "../../../..");
const SCANNED_DIRS = ["lib", "hooks", "components", "app"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "bundled-contracts" ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("compiled ABIs are the only ABI source in apps/web", () => {
  it("declares no inline ABI literal in non-test source", () => {
    const offenders: string[] = [];
    for (const dir of SCANNED_DIRS) {
      const root = path.join(webRoot, dir);
      if (!fs.existsSync(root)) continue;
      for (const file of walk(root)) {
        const source = fs.readFileSync(file, "utf8");
        if (/const\s+\w*ABI\w*\s*(?::[^=]+)?=\s*\[/i.test(source) || /\bparseAbi\s*\(/.test(source)) {
          offenders.push(path.relative(webRoot, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

const registryAbi = communityRegistryArtifact.abi as Abi;
const paramControllerAbi = paramControllerArtifact.abi as Abi;

function selectorOf(abi: Abi, name: string): string {
  const item = abi.find((entry) => entry.type === "function" && entry.name === name);
  if (!item || item.type !== "function") throw new Error(`missing ${name}`);
  return toFunctionSelector(item);
}

function makeSession() {
  const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
  return {
    sessionId: "s",
    deployerAddress: addr(0xabc),
    chainId: 84532,
    status: "in-progress",
    targetType: "registered",
    createdAt: "",
    updatedAt: "",
    deploymentConfig: { authorityMode: "governance_managed" },
    deploymentAddresses: Object.fromEntries(
      [
        "communityRegistry", "paramController", "accessManager", "membershipToken", "governor", "timelock",
        "requestHub", "draftsManager", "engagements", "valuableActionRegistry", "verifierPowerToken",
        "verifierElection", "verifierManager", "valuableActionSBT", "positionManager", "credentialManager",
        "cohortRegistry", "investmentCohortManager", "treasuryAdapter", "communityToken", "revenueRouter",
        "commerceDisputes", "marketplace", "housingManager",
      ].map((key, index) => [key, addr(0x1000 + index)])
    ),
    steps: [],
  } as any;
}

function makeContext() {
  return {
    config: {
      communityName: "Test",
      communityDescription: "Test",
      communityMetadataUri: "",
      treasuryVault: "0x1111111111111111111111111111111111111111",
      treasuryStableToken: "0x2222222222222222222222222222222222222222",
      supportedTokensCsv: "0x2222222222222222222222222222222222222222",
    },
    chainId: 84532,
    preflight: {
      sharedInfra: {
        paramController: { address: "0x00000000000000000000000000000000000000a2", hasCode: true, abiProbePassed: true },
        communityRegistry: { address: "0x00000000000000000000000000000000000000a1", hasCode: true, abiProbePassed: true },
        governanceLayerFactory: { address: "0x00000000000000000000000000000000000000b1", hasCode: true, abiProbePassed: true },
        verificationLayerFactory: { address: "0x00000000000000000000000000000000000000b2", hasCode: true, abiProbePassed: true },
        economicLayerFactory: { address: "0x00000000000000000000000000000000000000b3", hasCode: true, abiProbePassed: true },
        commerceLayerFactory: { address: "0x00000000000000000000000000000000000000b4", hasCode: true, abiProbePassed: true },
        coordinationLayerFactory: { address: "0x00000000000000000000000000000000000000b5", hasCode: true, abiProbePassed: true },
      },
    },
  } as any;
}

function makeClient(simulateContract: (args: any) => Promise<unknown>) {
  let nextId = 1n;
  return {
    getTransactionCount: vi.fn().mockResolvedValue(1n),
    getBytecode: vi.fn().mockResolvedValue("0x1234"),
    readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === "nextCommunityId") return nextId++;
      if (functionName === "ADMIN_ROLE") return 0n;
      if (functionName === "authority") return "0x0000000000000000000000000000000000001002";
      if (functionName === "hasRole") return [true, 0];
      return true;
    }),
    simulateContract: vi.fn(simulateContract),
    estimateContractGas: vi.fn().mockResolvedValue(21000n),
    waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success", logs: [] }),
  } as any;
}

async function runStep3(simulateContract: (args: any) => Promise<unknown>) {
  process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR = "0x2000000000000000000000000000000000000002";
  const writes: Array<{ address: string; abi: Abi; functionName: string; args: readonly unknown[] }> = [];
  const writeContractAsync = vi.fn(async (args: any) => {
    writes.push(args);
    return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  });
  const publicClient = makeClient(simulateContract);
  const executor = createFactoryDeployStepExecutor({
    publicClient,
    writeContractAsync: writeContractAsync as any,
    deployContractAsync: vi.fn(),
    connectedAddress: "0xabc1230000000000000000000000000000000000",
  });
  try {
    await executor("CONFIGURE_ACCESS_PERMISSIONS", makeSession(), makeContext());
  } finally {
    delete process.env.NEXT_PUBLIC_BOOTSTRAP_COORDINATOR;
  }
  return { writes, publicClient };
}

describe("registry wiring step uses the compiled CommunityRegistry/ParamController ABIs", () => {
  it("sends bootstrapCommunity once with 26 module addresses and no other registry write", async () => {
    const { writes } = await runStep3(async () => ({}));

    const registryWrites = writes.filter((w) => w.address.toLowerCase() === "0x00000000000000000000000000000000000000a1");
    expect(registryWrites.map((w) => w.functionName)).toEqual(["bootstrapCommunity"]);
    expect(writes.some((w) => w.functionName === "setRevenuePolicy")).toBe(false);

    const data = encodeFunctionData({
      abi: registryWrites[0].abi,
      functionName: "bootstrapCommunity",
      args: registryWrites[0].args as any,
    });
    expect(data.startsWith(selectorOf(registryAbi, "bootstrapCommunity"))).toBe(true);
    const decoded = decodeFunctionData({ abi: registryAbi, data });
    expect(Object.keys((decoded.args as any)[5])).toHaveLength(26);
  });

  it("falls back to the legacy path when simulation shows bootstrapCommunity is unavailable, without sending it", async () => {
    const { writes } = await runStep3(async ({ functionName }) => {
      if (functionName === "bootstrapCommunity") throw new Error("function selector not recognized");
      return {};
    });

    const names = writes.map((w) => w.functionName);
    expect(names).not.toContain("bootstrapCommunity");
    expect(names).toContain("registerCommunity");

    const revenue = writes.find((w) => w.functionName === "setRevenuePolicy")!;
    const revenueData = encodeFunctionData({ abi: revenue.abi, functionName: "setRevenuePolicy", args: revenue.args as any });
    expect(revenueData.startsWith(selectorOf(paramControllerAbi, "setRevenuePolicy"))).toBe(true);
    expect(selectorOf(paramControllerAbi, "setRevenuePolicy")).toBe("0xa5d3e812");

    const modules = writes.find((w) => w.functionName === "setModuleAddresses")!;
    const modulesData = encodeFunctionData({ abi: modules.abi, functionName: "setModuleAddresses", args: modules.args as any });
    expect(modulesData.startsWith(selectorOf(registryAbi, "setModuleAddresses"))).toBe(true);
    expect(selectorOf(registryAbi, "setModuleAddresses")).toBe("0x925291e7");
  });
});

describe("every function the executor calls exists in the compiled ABI", () => {
  it("matches abi identifier + functionName pairs against the compiled artifacts", async () => {
    const source = fs.readFileSync(path.join(webRoot, "lib/deploy/factory-step-executor.ts"), "utf8");
    const pairs = [...source.matchAll(/abi:\s*([A-Za-z_]\w*_ABI)\s*,\s*functionName:\s*"(\w+)"/g)].map((m) => [m[1], m[2]]);
    expect(pairs.length).toBeGreaterThan(10);
    const { COMPILED_ABIS } = await import("../../../../lib/deploy/compiled-abis");
    for (const [ident, fn] of pairs) {
      const abi = (COMPILED_ABIS as Record<string, Abi>)[ident];
      expect(abi, `${ident} is not a compiled ABI`).toBeTruthy();
      expect(
        abi.some((item) => item.type === "function" && item.name === fn),
        `${ident}.${fn} missing from compiled ABI`
      ).toBe(true);
    }
  });
});
