import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { CHAIN_ID_TO_NETWORK, KNOWN_NETWORKS } from "./networks";
import {
  Deployment,
  DeploymentLoadOptions,
  deploymentSchema
} from "./types";

const DEFAULT_FALLBACK = "base_sepolia";

function defaultDeploymentsDir(): string {
  if (process.env.SHIFT_DEPLOYMENTS_PATH) {
    return process.env.SHIFT_DEPLOYMENTS_PATH;
  }

  const pkgDir = path.dirname(fileURLToPath(new URL("../", import.meta.url)));
  return path.resolve(pkgDir, "../../deployments");
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function tryReadDeployment(filePath: string): Promise<Deployment | null> {
  try {
    const data = await readJson(filePath);
    return deploymentSchema.parse(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function resolveNetwork(options: DeploymentLoadOptions): string | undefined {
  if (options.network) {
    return options.network;
  }
  if (options.chainId !== undefined) {
    return CHAIN_ID_TO_NETWORK[options.chainId];
  }
  return undefined;
}

export async function loadDeployment(
  options: DeploymentLoadOptions = {}
): Promise<Deployment> {
  const deploymentsDir = options.deploymentsDir ?? defaultDeploymentsDir();
  const network = resolveNetwork(options);
  const fallback = options.fallbackNetwork ?? DEFAULT_FALLBACK;

  if (network) {
    const deployment = await tryReadDeployment(
      path.join(deploymentsDir, `${network}.json`)
    );
    if (deployment) {
      return deployment;
    }
    if (!KNOWN_NETWORKS.has(network)) {
      throw new Error(
        `Unknown network "${network}". Provide a valid network key or chainId.`
      );
    }
  }

  const fallbackDeployment = await tryReadDeployment(
    path.join(deploymentsDir, `${fallback}.json`)
  );
  if (fallbackDeployment) {
    return fallbackDeployment;
  }

  throw new Error(
    `Unable to load deployment. Searched for network="${network ?? "?"}" and fallback="${fallback}" in ${deploymentsDir}.`
  );
}

export async function loadAddressBook(
  options: DeploymentLoadOptions = {}
): Promise<Deployment["addresses"]> {
  const deployment = await loadDeployment(options);
  return deployment.addresses;
}

export const loadDeploymentSchema = deploymentSchema;
export const loadDeploymentOptionsSchema = z.object({
  network: z.string().optional(),
  chainId: z.number().int().optional(),
  deploymentsDir: z.string().optional(),
  fallbackNetwork: z.string().optional()
});
