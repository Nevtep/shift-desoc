import hre from "hardhat";
import { deploySharedInfraIfMissing, saveDeploymentFile, loadDeploymentFile } from "./community-deploy-lib";

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const shared = await deploySharedInfraIfMissing();

  const existing = loadDeploymentFile(network.name);
  const block = await ethers.provider.getBlockNumber();

  saveDeploymentFile(
    {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      communityId: existing?.communityId,
      addresses: {
        ...(existing?.addresses ?? {}),
        ...shared,
      },
      configuration: existing?.configuration,
      startBlock: existing?.startBlock ?? block,
    },
    network.name,
  );

  console.log("✅ Shared infra ready", shared);
}

main().catch((error) => {
  console.error("❌ deploy-shared-infra failed", error);
  process.exitCode = 1;
});
