import { ethers } from "hardhat";

async function checkGasCosts() {
  console.log("🔍 Analyzing gas costs for community creation...");

  // Tx hashes from the successful deployment
  const txHashes = [
    "0x7aa285316364083addab2df10edb913f16296854cc2d12b29655077bf11ec4a7",
    "0x91fbadcafde143494e1c4d6c518953a896232002f23218d65e16e82b06265b08",
    "0x8f8d1a5d3c2aa8e1b6ec9adef07d367bfb4d97d2bca617790a79a0a21024403c",
    "0xc13adb0855f53968a00e82e79652e094ce8e20ceef3512819ad9d964b69cb3ce",
    "0xc5ef590a8bf7b75682eccb2859b4494ee54ff7c4484fd48877c5eb6d1395f721",
    "0xbeb0dc4719ae36fe39675f96864aa870fcc7ab3c3365e6c27797c72be8983824",
    "0x4b9515b98939610850e06f61c236403c210557810c4f668d566cde85a99cd279",
    "0x7a2e6033b8e82b794e5c213289a975f8c4526bf7696c439cafba425275f2276e",
    "0x8a49300238acb2006b100a7fb76ba8ad51714d6ba4ea3bfd590294799702cd6c",
    "0x4b7f9e3cb63425f0092c02c3b7fec2db03b3bc04318cd39f56a01f9bb35e0353",
    "0x32d10787d813b75910a1d4d427b13b627138a4c769ff80131ea49da47ecaef1d",
    "0xd28e04d4d57625897f1640fea5607d3a1388f62caafe6f41a8efb95a72c8923c",
    "0xee46071aeab285b5ddf6144fef9480ca9570ef75444c2f3c0b2bafce86659f09",
    "0xd1dedddf70e3e9eaae940173108fd66f3e89d2ec88d1fb2169338824c18503c5",
    "0x455a1981f5324f4dfc9d9b4e70bc15172c7fd70a564d0c298a58803cc4ce3cfc",
  ];

  let totalGasUsed = 0n;
  let totalCostWei = 0n;
  const details = [];

  console.log("📊 Processing transactions...");

  for (let i = 0; i < Math.min(txHashes.length, 10); i++) {
    // Check first 10 tx for speed
    const txHash = txHashes[i];
    try {
      const receipt = await ethers.provider.getTransactionReceipt(txHash);
      const tx = await ethers.provider.getTransaction(txHash);

      if (receipt && tx) {
        const gasUsed = receipt.gasUsed;
        const gasPrice = tx.gasPrice || 0n;
        const cost = gasUsed * gasPrice;

        totalGasUsed += gasUsed;
        totalCostWei += cost;

        details.push({
          tx: i + 1,
          gasUsed: gasUsed.toString(),
          gasPrice: ethers.formatUnits(gasPrice, "gwei"),
          costEth: ethers.formatUnits(cost, "ether"),
        });

        console.log(
          `TX ${i + 1}: ${gasUsed.toString()} gas @ ${ethers.formatUnits(gasPrice, "gwei")} gwei = ${ethers.formatUnits(cost, "ether")} ETH`,
        );
      }
    } catch (error) {
      console.log(`❌ Error checking TX ${i + 1}: ${error}`);
    }
  }

  // Get current ETH price estimate (Base Sepolia uses ETH for gas)
  const totalCostEth = ethers.formatUnits(totalCostWei, "ether");

  console.log("\n📋 SUMMARY:");
  console.log(`Total Gas Used: ${totalGasUsed.toString()} gas`);
  console.log(`Total Cost: ${totalCostEth} ETH`);
  console.log(`Number of transactions: ${details.length}`);
  console.log(
    `Average gas per TX: ${totalGasUsed / BigInt(details.length)} gas`,
  );

  // Estimate USD cost (rough estimate: 1 ETH = $3000)
  const estimatedUSD = parseFloat(totalCostEth) * 3000;
  console.log(
    `Estimated USD cost: ~$${estimatedUSD.toFixed(4)} (assuming ETH = $3000)`,
  );

  console.log("\n💡 Cost Analysis:");
  console.log("- This was a REAL deployment on Base Sepolia testnet");
  console.log("- Gas costs are representative of mainnet deployment");
  console.log(
    "- Base network typically has lower gas costs than Ethereum mainnet",
  );
  console.log("- Community creation involves ~28 transactions total");
}

checkGasCosts().catch(console.error);
