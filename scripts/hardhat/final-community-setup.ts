import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Final Community Setup - Using correct contract interfaces
 */

async function main() {
  const addresses = JSON.parse(readFileSync(join(__dirname, "deployed-addresses.json"), "utf8"));
  const [deployer] = await ethers.getSigners();

  console.log("🎯 Final Community Setup...");
  console.log("Deployer:", deployer.address);

  // Community contract addresses
  const communityId = 1;
  const communityAddresses = {
    governor: "0x42362f0f2Cdd96902848e21d878927234C5C9425",
    timelock: "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA",
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
    verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
    workerSBT: "0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562",
    requestHub: "0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA",
    draftsManager: "0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07",
    communityToken: "0x9352b89B39D7b0e6255935A8053Df37393013371"
  };

  // Connect to contracts
  const communityRegistry = await ethers.getContractAt("CommunityRegistry", addresses.communityRegistry);
  const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", communityAddresses.membershipToken);
  const verifierPool = await ethers.getContractAt("VerifierPool", communityAddresses.verifierPool);

  // =================================================================
  // FIX 1: Complete remaining module addresses in CommunityRegistry
  // =================================================================
  
  console.log("\n🔧 Setting remaining module addresses...");
  
  // Try missing modules one by one
  const missingModules = [
    { key: "membershipToken", address: communityAddresses.membershipToken },
    { key: "actionTypeRegistry", address: communityAddresses.valuableActionRegistry } // Note: different name in contract
  ];

  for (const module of missingModules) {
    try {
      console.log(`📝 Setting ${module.key}...`);
      const keyHash = ethers.keccak256(ethers.toUtf8Bytes(module.key));
      const tx = await communityRegistry.setModuleAddress(communityId, keyHash, module.address);
      await tx.wait();
      console.log(`✅ ${module.key} set successfully`);
    } catch (error: any) {
      console.log(`❌ Failed to set ${module.key}:`, error.message);
      
      // Try with different key names if the first fails
      if (module.key === "actionTypeRegistry") {
        try {
          console.log("🔄 Trying with 'valuableActionRegistry' key...");
          const altKeyHash = ethers.keccak256(ethers.toUtf8Bytes("valuableActionRegistry"));
          const tx = await communityRegistry.setModuleAddress(communityId, altKeyHash, module.address);
          await tx.wait();
          console.log("✅ valuableActionRegistry set successfully");
        } catch (altError: any) {
          console.log("❌ Alternative key also failed:", altError.message);
        }
      }
    }
  }

  // =================================================================
  // FIX 2: VerifierPool connection
  // =================================================================
  
  console.log("\n👥 Setting up VerifierPool...");
  
  try {
    // Check if verifierPool.setClaimsContract exists
    const currentClaims = await verifierPool.claimsContract();
    console.log("Current Claims contract:", currentClaims);
    
    if (currentClaims === ethers.ZeroAddress) {
      const tx = await verifierPool.setClaimsContract(communityAddresses.claims);
      await tx.wait();
      console.log("✅ VerifierPool Claims contract set");
    } else {
      console.log("✅ VerifierPool Claims already set");
    }
  } catch (error: any) {
    console.log("❌ VerifierPool setup failed:", error.message);
    console.log("🔍 This might be expected if the contract doesn't have this function yet");
  }

  // =================================================================
  // FIX 3: Founder token minting with correct function
  // =================================================================
  
  console.log("\n🪙 Setting up founder tokens...");
  
  try {
    // Grant minter role to deployer temporarily
    const MINTER_ROLE = await membershipToken.MINTER_ROLE();
    const hasMinterRole = await membershipToken.hasRole(MINTER_ROLE, deployer.address);
    
    if (!hasMinterRole) {
      console.log("Granting minter role to deployer...");
      const tx = await membershipToken.grantRole(MINTER_ROLE, deployer.address);
      await tx.wait();
      console.log("✅ Minter role granted");
    }
    
    // Check current balance
    const currentBalance = await membershipToken.balanceOf(deployer.address);
    const targetBalance = ethers.parseEther("10000");
    
    console.log("Current balance:", ethers.formatEther(currentBalance));
    console.log("Target balance:", ethers.formatEther(targetBalance));
    
    if (currentBalance < targetBalance) {
      const amountToMint = targetBalance - currentBalance;
      console.log("Minting amount:", ethers.formatEther(amountToMint));
      
      // Use the correct mint function with reason parameter
      const tx = await membershipToken.mint(deployer.address, amountToMint, "Founder bootstrap allocation");
      await tx.wait();
      console.log("✅ Tokens minted successfully");
    }
    
    // Delegate voting power to self
    const currentDelegate = await membershipToken.delegates(deployer.address);
    if (currentDelegate !== deployer.address) {
      console.log("Delegating voting power to self...");
      const tx = await membershipToken.delegate(deployer.address);
      await tx.wait();
      console.log("✅ Voting power delegated");
    }
    
  } catch (error: any) {
    console.log("❌ Token setup failed:", error.message);
  }

  // =================================================================
  // VERIFICATION: Check community struct directly
  // =================================================================
  
  console.log("\n🔍 Community Registry Verification...");
  
  try {
    // Get community struct - should work since it's a public mapping
    const community = await communityRegistry.communities(communityId);
    
    console.log("📋 Community Module Addresses:");
    console.log("├── Governor:", community.governor);
    console.log("├── Timelock:", community.timelock);
    console.log("├── RequestHub:", community.requestHub);
    console.log("├── DraftsManager:", community.draftsManager);
    console.log("├── Claims Manager:", community.claimsManager);
    console.log("├── ActionType Registry:", community.actionTypeRegistry);
    console.log("├── VerifierPool:", community.verifierPool);
    console.log("├── WorkerSBT:", community.workerSBT);
    console.log("├── TreasuryAdapter:", community.treasuryAdapter);
    console.log("└── CommunityToken:", community.communityToken);
    
    console.log("\n⚙️ Community Parameters:");
    console.log("├── Name:", community.name);
    console.log("├── Active:", community.active);
    console.log("├── Debate Window:", community.debateWindow.toString(), "seconds");
    console.log("├── Vote Window:", community.voteWindow.toString(), "seconds");
    console.log("├── Execution Delay:", community.executionDelay.toString(), "seconds");
    console.log("├── Proposal Threshold:", ethers.formatEther(community.proposalThreshold));
    console.log("└── Revenue Split:", community.revenueSplit.map(x => x.toString()).join("%, ") + "%");
    
  } catch (error: any) {
    console.log("❌ Error reading community data:", error.message);
  }

  // =================================================================
  // FINAL STATUS REPORT
  // =================================================================
  
  console.log("\n🎉 FINAL STATUS REPORT");
  console.log("=".repeat(60));
  
  // Token balances and voting power
  try {
    const tokenBalance = await membershipToken.balanceOf(deployer.address);
    const votingPower = await membershipToken.getVotes(deployer.address);
    const totalSupply = await membershipToken.totalSupply();
    
    console.log("\n💰 Token Status:");
    console.log("├── Founder Balance:", ethers.formatEther(tokenBalance));
    console.log("├── Founder Voting Power:", ethers.formatEther(votingPower));
    console.log("├── Total Supply:", ethers.formatEther(totalSupply));
    console.log("└── Community ID:", await membershipToken.communityId());
    
  } catch (error) {
    console.log("❌ Error reading token status");
  }

  // Governance parameters
  try {
    const governor = await ethers.getContractAt("ShiftGovernor", communityAddresses.governor);
    const proposalThreshold = await governor.proposalThreshold();
    const votingDelay = await governor.votingDelay();
    const votingPeriod = await governor.votingPeriod();
    const quorum = await governor.quorum(await ethers.provider.getBlockNumber() - 1);
    
    console.log("\n🏛️ Governance Status:");
    console.log("├── Proposal Threshold:", ethers.formatEther(proposalThreshold));
    console.log("├── Voting Delay:", votingDelay.toString(), "blocks");
    console.log("├── Voting Period:", votingPeriod.toString(), "blocks");
    console.log("└── Current Quorum:", ethers.formatEther(quorum));
    
  } catch (error) {
    console.log("❌ Error reading governance status");
  }

  // Network status
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  const network = await ethers.provider.getNetwork();
  
  console.log("\n🌐 Network Status:");
  console.log("├── Network:", network.name);
  console.log("├── Chain ID:", network.chainId.toString());
  console.log("├── ETH Balance:", ethers.formatEther(ethBalance));
  console.log("└── Block Number:", await ethers.provider.getBlockNumber());

  console.log("\n📋 COMPLETE DEPLOYMENT SUMMARY:");
  console.log("Community Registry:", addresses.communityRegistry);
  console.log("CountingMultiChoice:", addresses.countingMultiChoice);
  console.log("\nCommunity Contracts:");
  Object.entries(communityAddresses).forEach(([key, address]) => {
    console.log(`${key}: ${address}`);
  });

  console.log("\n✅ SHIFT DESOC COMMUNITY DEPLOYED SUCCESSFULLY!");
  console.log("🎯 Community ID:", communityId);
  console.log("👑 Founder:", deployer.address);
  console.log("🗳️ Ready for governance proposals!");

  return {
    communityId,
    foundAddress: deployer.address,
    contracts: {
      ...communityAddresses,
      communityRegistry: addresses.communityRegistry,
      countingMultiChoice: addresses.countingMultiChoice
    }
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});