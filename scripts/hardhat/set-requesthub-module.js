const hre = require("hardhat");
const { ethers, network } = hre;
const path = require("path");
const fs = require("fs");

async function main() {
  const networkName = network.name;
  const deploymentPath = path.join(__dirname, "../../deployments", `${networkName}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found at ${deploymentPath}`);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const communityRegistry = deployments.addresses?.communityRegistry;
  if (!communityRegistry) {
    throw new Error("communityRegistry address missing in deployment file");
  }

  const communityId = 1;
  const newRequestHub = "0x2EC25bcB3c2b1b3981e068132b271859F36e7b52";
  const moduleKey = ethers.keccak256(ethers.toUtf8Bytes("requestHub"));

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);
  console.log(`Network: ${networkName}`);
  console.log(`CommunityRegistry: ${communityRegistry}`);
  console.log(`Updating requestHub for community ${communityId} -> ${newRequestHub}`);

  const registry = await ethers.getContractAt("CommunityRegistry", communityRegistry, signer);
  const tx = await registry.setModuleAddress(communityId, moduleKey, newRequestHub);
  console.log(`tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`confirmed in block ${receipt?.blockNumber}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
