import { ethers, network } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const addr = await signer.getAddress();
  const nonce = await ethers.provider.getTransactionCount(addr, "latest");

  const maxFeePerGas = ethers.parseUnits(process.env.MAX_FEE_PER_GAS_GWEI || "20", "gwei");
  const maxPriorityFeePerGas = ethers.parseUnits(process.env.MAX_PRIORITY_FEE_PER_GAS_GWEI || "5", "gwei");

  console.log("Network:", network.name);
  console.log("Address:", addr);
  console.log("Using nonce:", nonce);
  console.log("maxFeePerGas:", maxFeePerGas.toString());
  console.log("maxPriorityFeePerGas:", maxPriorityFeePerGas.toString());

  const tx = await signer.sendTransaction({
    to: addr,
    value: 0n,
    nonce,
    maxFeePerGas,
    maxPriorityFeePerGas,
  });

  console.log("Sent tx:", tx.hash);
  const receipt = await tx.wait();
  console.log("Mined in block:", receipt?.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
