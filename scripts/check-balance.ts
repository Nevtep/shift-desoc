import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentsFile = {
  addresses?: {
    communityToken?: string;
  };
};

const DEFAULT_RATIO_WARN_BPS = 10_000;
const DEFAULT_RATIO_CRIT_BPS = 9_950;

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
  throw new Error("No deployments file found. Expected deployments/<network>.json or deployments/latest.json");
}

async function main() {
  const warnThresholdBps = Number(process.env.BACKING_WARN_BPS ?? DEFAULT_RATIO_WARN_BPS);
  const critThresholdBps = Number(process.env.BACKING_CRIT_BPS ?? DEFAULT_RATIO_CRIT_BPS);

  const deployment = loadDeployment(network.name);
  const communityTokenAddress = deployment.addresses?.communityToken;
  if (!communityTokenAddress) {
    throw new Error("communityToken address missing in deployment file");
  }

  const communityToken = await ethers.getContractAt("CommunityToken", communityTokenAddress);
  const usdcAddress = await communityToken.USDC();
  const usdc = new ethers.Contract(
    usdcAddress,
    ["function balanceOf(address) view returns (uint256)"],
    ethers.provider,
  );

  const [supplyRaw, reservesRaw] = await Promise.all([
    communityToken.totalSupply(),
    usdc.balanceOf(communityTokenAddress),
  ]);

  const supply = Number(ethers.formatUnits(supplyRaw, 6));
  const reserves = Number(ethers.formatUnits(reservesRaw, 6));
  const ratio = supplyRaw === 0n ? 1 : Number((reservesRaw * 10_000n) / supplyRaw);

  let status = "HEALTHY";
  if (ratio < critThresholdBps) {
    status = "CRITICAL";
  } else if (ratio < warnThresholdBps) {
    status = "WARNING";
  }

  console.log("D-1 Backing Ratio Monitor");
  console.log("============================================================");
  console.log("Network:", network.name);
  console.log("CommunityToken:", communityTokenAddress);
  console.log("USDC:", usdcAddress);
  console.log("Total Supply:", supply.toFixed(6));
  console.log("USDC Reserves:", reserves.toFixed(6));
  console.log("Backing Ratio (bps):", ratio);
  console.log("Status:", status);

  if (status !== "HEALTHY") {
    console.log("Action: Follow docs/EN/guides/security-runbook-d1.md incident response steps.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
