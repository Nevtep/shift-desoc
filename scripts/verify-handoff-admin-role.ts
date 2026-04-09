import { readFile } from "node:fs/promises";
import path from "node:path";

import "dotenv/config";
// @ts-ignore TS5097: ts-node ESM runtime requires explicit .ts extension in this script.
import { selectorFromSignature } from "../apps/web/lib/actions/permission-matrix.ts";

type DeploymentShape = {
  accessManager?: string;
  timelock?: string;
  deployer?: string;
  deployerAddress?: string;
  bootstrapCoordinator?: string;
  addresses?: Record<string, string | undefined>;
};

function resolveDeploymentAddress(deployments: DeploymentShape, key: string): string | undefined {
  const fromTopLevel = (deployments as unknown as Record<string, unknown>)[key];
  if (typeof fromTopLevel === "string") return fromTopLevel;
  const fromAddresses = deployments.addresses?.[key];
  if (typeof fromAddresses === "string") return fromAddresses;
  return undefined;
}

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const index = args.findIndex((entry) => entry === flag);
  if (index < 0) return undefined;
  return args[index + 1];
}

function isAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function loadDeployments(network: string): Promise<DeploymentShape> {
  const root = process.cwd();
  const explicitFile = getArg("--file");
  const filePath = explicitFile
    ? path.resolve(root, explicitFile)
    : path.join(root, "deployments", `${network}.json`);

  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as DeploymentShape;
}

function pickRpc(network: string): string {
  if (network === "base_sepolia") {
    return process.env.RPC_BASE_SEPOLIA ?? "";
  }
  if (network === "base") {
    return process.env.RPC_BASE_MAINNET ?? process.env.RPC_BASE ?? "";
  }
  return process.env.RPC_URL ?? process.env.RPC_BASE_SEPOLIA ?? "";
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function padHex(value: string): string {
  return stripHexPrefix(value).padStart(64, "0");
}

function encodeHasRoleCalldata(role: bigint, account: `0x${string}`): `0x${string}` {
  const selector = stripHexPrefix(selectorFromSignature("hasRole(uint64,address)"));
  const encodedRole = padHex(role.toString(16));
  const encodedAddress = padHex(account);
  return `0x${selector}${encodedRole}${encodedAddress}` as `0x${string}`;
}

function decodeBigIntResult(result: string): bigint {
  return BigInt(result);
}

function decodeBoolTupleResult(result: string): boolean {
  const normalized = stripHexPrefix(result);
  if (normalized.length < 64) return false;
  const firstWord = normalized.slice(0, 64);
  return BigInt(`0x${firstWord}`) !== 0n;
}

async function rpcCall(rpcUrl: string, to: `0x${string}`, data: `0x${string}`): Promise<string> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"]
    })
  });

  if (!response.ok) {
    throw new Error(`RPC call failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { result?: string; error?: { message?: string } };
  if (payload.error) {
    throw new Error(`RPC error: ${payload.error.message ?? "unknown"}`);
  }
  if (!payload.result) {
    throw new Error("RPC response missing result");
  }
  return payload.result;
}

async function main() {
  const network = getArg("--network") ?? "base_sepolia";
  const deployments = await loadDeployments(network);

  const accessManagerRaw = resolveDeploymentAddress(deployments, "accessManager");
  const timelockRaw = resolveDeploymentAddress(deployments, "timelock");
  const bootstrapRaw = resolveDeploymentAddress(deployments, "bootstrapCoordinator");

  if (!isAddress(accessManagerRaw)) {
    throw new Error("Missing accessManager in deployment file");
  }
  if (!isAddress(timelockRaw)) {
    throw new Error("Missing timelock in deployment file");
  }

  const accessManagerAddress = accessManagerRaw;
  const timelockAddress = timelockRaw;

  const deployer = isAddress(deployments.deployerAddress)
    ? deployments.deployerAddress
    : isAddress(deployments.deployer)
      ? deployments.deployer
      : null;
  const bootstrapCoordinator = isAddress(bootstrapRaw) ? bootstrapRaw : null;

  const rpcUrl = pickRpc(network);
  if (!rpcUrl) {
    throw new Error(`Missing RPC URL for network ${network}`);
  }

  const adminRoleResult = await rpcCall(
    rpcUrl,
    accessManagerAddress,
    selectorFromSignature("ADMIN_ROLE()") as `0x${string}`
  );
  const adminRole = decodeBigIntResult(adminRoleResult);

  const hasRole = async (account: `0x${string}` | null) => {
    if (!account) return null;
    const result = await rpcCall(rpcUrl, accessManagerAddress, encodeHasRoleCalldata(adminRole, account));
    return decodeBoolTupleResult(result);
  };

  const output = {
    version: "1",
    network,
    accessManager: accessManagerAddress,
    adminRole: adminRole.toString(),
    timelock: timelockAddress,
    timelockHasAdmin: await hasRole(timelockAddress),
    deployer,
    deployerHasAdmin: await hasRole(deployer),
    bootstrapCoordinator,
    bootstrapHasAdmin: await hasRole(bootstrapCoordinator)
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
