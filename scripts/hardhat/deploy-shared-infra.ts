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

  console.log("✅ Shared infra ready (CommunityRegistry, ParamController, BootstrapCoordinator, LayerFactories)", shared);

  console.log("\nSuggested .env entries:");
  console.log(`NEXT_PUBLIC_PARAM_CONTROLLER=${shared.paramController}`);
  console.log(`NEXT_PUBLIC_COMMUNITY_REGISTRY=${shared.communityRegistry}`);
  console.log(`NEXT_PUBLIC_BOOTSTRAP_COORDINATOR=${shared.bootstrapCoordinator}`);
  console.log(`NEXT_PUBLIC_GOVERNANCE_LAYER_FACTORY=${shared.governanceLayerFactory}`);
  console.log(`NEXT_PUBLIC_VERIFICATION_LAYER_FACTORY=${shared.verificationLayerFactory}`);
  console.log(`NEXT_PUBLIC_ECONOMIC_LAYER_FACTORY=${shared.economicLayerFactory}`);
  console.log(`NEXT_PUBLIC_COMMERCE_LAYER_FACTORY=${shared.commerceLayerFactory}`);
  console.log(`NEXT_PUBLIC_COORDINATION_LAYER_FACTORY=${shared.coordinationLayerFactory}`);
}

main().catch((error) => {
  console.error("❌ deploy-shared-infra failed", error);
  process.exitCode = 1;
});
