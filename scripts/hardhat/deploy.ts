import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Shift DeSoc contracts...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy Membership Token
  console.log("\n📄 Deploying MembershipTokenERC20Votes...");
  const Token = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const token = await Token.deploy("Shift Membership", "sMEM");
  await token.waitForDeployment();
  console.log("✅ Token deployed to:", await token.getAddress());

  // Deploy Timelock (3600 seconds = 1 hour delay)
  console.log("\n⏰ Deploying TimelockController...");
  const Timelock = await ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(3600, [], [], ethers.ZeroAddress);
  await timelock.waitForDeployment();
  console.log("✅ Timelock deployed to:", await timelock.getAddress());

  // Deploy Governor
  console.log("\n🏛️ Deploying ShiftGovernor...");
  const Gov = await ethers.getContractFactory("ShiftGovernor");
  const gov = await Gov.deploy(await token.getAddress(), await timelock.getAddress());
  await gov.waitForDeployment();
  console.log("✅ Governor deployed to:", await gov.getAddress());

  // Deploy CountingMultiChoice
  console.log("\n🗳️ Deploying CountingMultiChoice...");
  const Multi = await ethers.getContractFactory("CountingMultiChoice");
  const multi = await Multi.deploy();
  await multi.waitForDeployment();
  console.log("✅ CountingMultiChoice deployed to:", await multi.getAddress());

  console.log("\n🎯 Deployment Summary:");
  console.log("=====================================");
  console.log("Deployer:", deployer.address);
  console.log("Token:", await token.getAddress());
  console.log("Timelock:", await timelock.getAddress());
  console.log("Governor:", await gov.getAddress());
  console.log("CountingMulti:", await multi.getAddress());
  console.log("\n⚠️  Note: CountingMultiChoice must be connected via governance proposal");
  console.log("\n🌐 Multi-Community Architecture:");
  console.log("This deployment creates contracts for ONE community.");
  console.log("For multiple communities, run this script multiple times or");
  console.log("consider implementing a CommunityFactory pattern for scaled deployment.");
}
main().catch((e) => { console.error(e); process.exit(1); });
