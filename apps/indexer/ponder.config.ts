import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { createConfig } from "@ponder/core";
import { http } from "viem";

type DeploymentAddresses = {
  communityRegistry?: string;
  paramController?: string;
  membershipToken?: string;
  timelock?: string;
  governor?: string;
  countingMultiChoice?: string;
  verifierPowerToken?: string;
  verifierElection?: string;
  verifierManager?: string;
  valuableActionRegistry?: string;
  claims?: string;
  valuableActionSBT?: string;
  communityToken?: string;
  treasuryAdapter?: string;
  requestHub?: string;
  draftsManager?: string;
};

type DeploymentFile = {
  addresses?: DeploymentAddresses;
  startBlock?: number;
};

const network = (process.env.PONDER_NETWORK ?? "base_sepolia") as "base" | "base_sepolia";

const deploymentPath = path.join(__dirname, "../../deployments", `${network}.json`);

const loadDeployment = (): DeploymentFile => {
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found at ${deploymentPath}. Set PONDER_NETWORK or add the file.`);
  }

  const parsed = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentFile;
  if (!parsed.addresses) {
    throw new Error(`Deployment file ${deploymentPath} is missing an addresses field.`);
  }
  return parsed;
};

const deployment = loadDeployment();
const startBlock = process.env.PONDER_START_BLOCK
  ? Number.parseInt(process.env.PONDER_START_BLOCK, 10)
  : deployment.startBlock;

const abiPath = (file: string) => path.join(__dirname, "abis", file);
const loadAbi = (file: string) => JSON.parse(fs.readFileSync(abiPath(file), "utf8")).abi;

export default createConfig({
  networks: {
    base: {
      chainId: 8453,
      transport: http(process.env.RPC_BASE ?? "https://mainnet.base.org")
    },
    base_sepolia: {
      chainId: 84532,
      transport: http(process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org")
    }
  },
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/shift"
  },
  contracts: {
    CommunityRegistry: {
      network,
      address: deployment.addresses?.communityRegistry ?? "",
      abi: loadAbi("CommunityRegistry.json"),
      startBlock
    },
    RequestHub: {
      network,
      address: deployment.addresses?.requestHub ?? "",
      abi: loadAbi("RequestHub.json"),
      startBlock
    },
    DraftsManager: {
      network,
      address: deployment.addresses?.draftsManager ?? "",
      abi: loadAbi("DraftsManager.json"),
      startBlock
    },
    ShiftGovernor: {
      network,
      address: deployment.addresses?.governor ?? "",
      abi: loadAbi("ShiftGovernor.json"),
      startBlock
    },
    CountingMultiChoice: {
      network,
      address: deployment.addresses?.countingMultiChoice ?? "",
      abi: loadAbi("CountingMultiChoice.json"),
      startBlock
    },
    Claims: {
      network,
      address: deployment.addresses?.claims ?? "",
      abi: loadAbi("Claims.json"),
      startBlock
    },
    VerifierManager: {
      network,
      address: deployment.addresses?.verifierManager ?? "",
      abi: loadAbi("VerifierManager.json"),
      startBlock
    },
    ValuableActionRegistry: {
      network,
      address: deployment.addresses?.valuableActionRegistry ?? "",
      abi: loadAbi("ValuableActionRegistry.json"),
      startBlock
    }
  }
});
