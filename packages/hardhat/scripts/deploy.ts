import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const Token = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const token = await Token.deploy("Shift Membership", "sMEM");
  await token.waitForDeployment();

  const Timelock = await ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(3600, [], []);
  await timelock.waitForDeployment();

  const Gov = await ethers.getContractFactory("ShiftGovernor");
  const gov = await Gov.deploy(await token.getAddress(), await timelock.getAddress());
  await gov.waitForDeployment();

  const Multi = await ethers.getContractFactory("CountingMultiChoice");
  const multi = await Multi.deploy();
  await multi.waitForDeployment();

  // Wire counting module
  const govCtr = await ethers.getContractAt("ShiftGovernor", await gov.getAddress());
  await (await govCtr.setCountingMulti(await multi.getAddress())).wait();

  console.log("Deployer:", deployer.address);
  console.log("Token:", await token.getAddress());
  console.log("Timelock:", await timelock.getAddress());
  console.log("Governor:", await gov.getAddress());
  console.log("CountingMulti:", await multi.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
