import { ethers, network } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const addr = await signer.getAddress();
  const latest = await ethers.provider.getTransactionCount(addr, "latest");
  const pending = await ethers.provider.getTransactionCount(addr, "pending");
  const balance = await ethers.provider.getBalance(addr);
  const feeData = await ethers.provider.getFeeData();

  console.log("Network:", network.name);
  console.log("Address:", addr);
  console.log("Nonce latest:", latest);
  console.log("Nonce pending:", pending);
  console.log("Pending gap:", pending - latest);
  console.log("Balance (ETH):", ethers.formatEther(balance));
  console.log("maxFeePerGas:", feeData.maxFeePerGas?.toString() ?? "n/a");
  console.log("maxPriorityFeePerGas:", feeData.maxPriorityFeePerGas?.toString() ?? "n/a");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
