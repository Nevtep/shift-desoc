import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("Network:", (await ethers.provider.getNetwork()).name);
}

main().catch(console.error);
