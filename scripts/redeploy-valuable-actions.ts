import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Redeploy ValuableActionRegistry (and dependent Claims) and update deployments JSON.
 * Assumes the caller has the necessary admin/governance rights to update CommunityRegistry module addresses.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const network = (await ethers.provider.getNetwork()).name;

  const deploymentsPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Deployment file not found: ${deploymentsPath}`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const communityId: number = deploymentData.communityId || 1;
  const addresses = deploymentData.addresses;

  console.log(`🔄 Redeploying VA stack on ${network} as ${deployer.address}`);
  console.log(`📄 Using communityId=${communityId}`);

  // Deploy new ValuableActionRegistry
  const ValuableActionRegistry = await ethers.getContractFactory("ValuableActionRegistry");
  const valuableActionRegistry = await ValuableActionRegistry.deploy(
    addresses.timelock,
    addresses.communityRegistry,
  );
  await valuableActionRegistry.waitForDeployment();
  const valuableActionRegistryAddress = await valuableActionRegistry.getAddress();
  console.log(`✅ ValuableActionRegistry deployed: ${valuableActionRegistryAddress}`);

  // Deploy new Claims pointing to the new registry
  const Claims = await ethers.getContractFactory("Claims");
  const claims = await Claims.deploy(
    addresses.timelock,
    valuableActionRegistryAddress,
    addresses.verifierManager,
    addresses.valuableActionSBT,
    addresses.membershipToken,
    communityId,
  );
  await claims.waitForDeployment();
  const claimsAddress = await claims.getAddress();
  console.log(`✅ Claims deployed: ${claimsAddress}`);

  // Update CommunityRegistry module addresses
  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    addresses.communityRegistry,
  );

  const moduleAddresses = {
    governor: addresses.governor,
    timelock: addresses.timelock,
    requestHub: addresses.requestHub,
    draftsManager: addresses.draftsManager,
    claimsManager: claimsAddress,
    valuableActionRegistry: valuableActionRegistryAddress,
    verifierPowerToken: addresses.verifierPowerToken,
    verifierElection: addresses.verifierElection,
    verifierManager: addresses.verifierManager,
    valuableActionSBT: addresses.valuableActionSBT,
    treasuryAdapter: addresses.treasuryAdapter,
    communityToken: addresses.communityToken,
    paramController: addresses.paramController,
  };

  console.log("🔧 Updating CommunityRegistry module addresses...");
  const tx = await communityRegistry.setModuleAddresses(communityId, moduleAddresses);
  await tx.wait();
  console.log("✅ CommunityRegistry updated");

  // Persist new addresses
  deploymentData.addresses.valuableActionRegistry = valuableActionRegistryAddress;
  deploymentData.addresses.claims = claimsAddress;
  deploymentData.timestamp = new Date().toISOString();

  fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentData, null, 2), "utf8");
  const latestPath = path.join(__dirname, "..", "deployments", "latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(deploymentData, null, 2), "utf8");

  console.log(`💾 Updated deployments written to ${deploymentsPath} and latest.json`);
}

main().catch((err) => {
  console.error("Redeploy failed:", err);
  process.exitCode = 1;
});
