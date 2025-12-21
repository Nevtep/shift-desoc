import fs from "fs";
import path from "path";
import { ethers, network } from "hardhat";

async function main() {
  const deploymentsPath = path.join(__dirname, "../../deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`Deployment file not found at ${deploymentsPath}`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const communityRegistry = deployments.addresses?.communityRegistry;

  if (!communityRegistry) {
    throw new Error("Missing communityRegistry address in deployment file");
  }

  console.log(`Deploying RequestHub to network ${network.name} with CommunityRegistry ${communityRegistry}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const RequestHub = await ethers.getContractFactory("RequestHub");
  const requestHub = await RequestHub.deploy(communityRegistry);
  await requestHub.waitForDeployment();

  const requestHubAddress = await requestHub.getAddress();
  const receipt = await requestHub.deploymentTransaction()?.wait();
  const blockNumber = receipt?.blockNumber;

  console.log(`RequestHub deployed at ${requestHubAddress} (block ${blockNumber ?? "unknown"})`);

  deployments.addresses = deployments.addresses || {};
  deployments.addresses.requestHub = requestHubAddress;
  deployments.timestamp = new Date().toISOString();
  if (blockNumber && !deployments.startBlock) {
    deployments.startBlock = blockNumber;
  }

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`Updated ${deploymentsPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
