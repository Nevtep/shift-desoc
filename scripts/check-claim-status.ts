import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentsFile = {
  addresses?: {
    engagements?: string;
    valuableActionRegistry?: string;
  };
};

const DEFAULT_LOOKBACK = 50;
const DEFAULT_STALE_GRACE_SECONDS = 3600;

function loadDeployment(networkName: string): DeploymentsFile {
  const root = process.cwd();
  const preferred = path.join(root, "deployments", `${networkName}.json`);
  const latest = path.join(root, "deployments", "latest.json");

  if (fs.existsSync(preferred)) {
    return JSON.parse(fs.readFileSync(preferred, "utf8"));
  }
  if (fs.existsSync(latest)) {
    return JSON.parse(fs.readFileSync(latest, "utf8"));
  }
  throw new Error(
    "No deployments file found. Expected deployments/<network>.json or deployments/latest.json",
  );
}

async function main() {
  const lookback = Number(process.env.ENGAGEMENT_LOOKBACK ?? DEFAULT_LOOKBACK);
  const staleGraceSeconds = Number(
    process.env.ENGAGEMENT_STALE_GRACE_SECONDS ?? DEFAULT_STALE_GRACE_SECONDS,
  );

  const deployment = loadDeployment(network.name);
  const engagementsAddress = deployment.addresses?.engagements;
  const registryAddress = deployment.addresses?.valuableActionRegistry;

  if (!engagementsAddress || !registryAddress) {
    throw new Error(
      "engagements or valuableActionRegistry address missing in deployment file",
    );
  }

  const engagements = await ethers.getContractAt("Engagements", engagementsAddress);
  const registry = await ethers.getContractAt("ValuableActionRegistry", registryAddress);

  const total = Number(await engagements.nextEngagementId()) - 1;
  const fromId = Math.max(1, total - lookback + 1);

  let pending = 0;
  let approved = 0;
  let rejected = 0;
  let revoked = 0;
  const stalePending: number[] = [];

  console.log("D-2 Engagement Anomaly Monitor");
  console.log("============================================================");
  console.log("Network:", network.name);
  console.log("Engagements:", engagementsAddress);
  console.log("ValuableActionRegistry:", registryAddress);
  console.log("Scan range:", `${fromId}..${total}`);

  const now = Math.floor(Date.now() / 1000);

  for (let id = fromId; id <= total; id++) {
    const engagement = await engagements.getEngagement(id);
    const status: bigint = engagement.status;
    const typeId: bigint = engagement.typeId;

    if (status === 0n) {
      pending += 1;
      const action = await registry.getValuableAction(typeId);
      const verifyWindow = Number(action.verifyWindow);
      const createdAt = Number(engagement.createdAt);
      const staleThreshold = createdAt + verifyWindow + staleGraceSeconds;
      if (now > staleThreshold) {
        stalePending.push(id);
      }
    } else if (status === 1n) {
      approved += 1;
    } else if (status === 2n) {
      rejected += 1;
    } else if (status === 3n) {
      revoked += 1;
    }
  }

  const scanned = Math.max(0, total - fromId + 1);
  console.log("Scanned:", scanned);
  console.log("Pending:", pending);
  console.log("Approved:", approved);
  console.log("Rejected:", rejected);
  console.log("Revoked:", revoked);

  const decided = approved + rejected + revoked;
  const rejectionRate = decided === 0 ? 0 : (rejected / decided) * 100;
  console.log("Rejection rate (decided only):", rejectionRate.toFixed(2) + "%");

  if (stalePending.length > 0) {
    console.log("\nALERT: stale pending engagements detected:", stalePending.join(", "));
    console.log(
      "Action: Follow docs/EN/guides/security-runbook-d2.md triage and mitigation steps.",
    );
    process.exitCode = 1;
    return;
  }

  if (rejectionRate > 80 || rejectionRate < 5) {
    console.log("\nWARNING: outcome distribution is outside expected operational band.");
    console.log("Action: Investigate for process drift/manipulation per D-2 runbook.");
  } else {
    console.log("\nStatus: HEALTHY");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
