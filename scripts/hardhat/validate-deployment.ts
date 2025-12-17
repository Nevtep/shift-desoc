import { ethers } from "hardhat";

/**
 * Post-Deployment Validation Script
 * 
 * This script validates that all contracts are deployed correctly
 * and the community is properly initialized.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🔍 Validating Shift DeSoc Deployment...");
  console.log("Validator:", deployer.address);

  // =================================================================
  // CONFIGURATION - Update these addresses after deployment
  // =================================================================
  
  const ADDRESSES = {
    communityRegistry: "0x...",      // From master deployment
    communityFactory: "0x...",       // From master deployment  
    countingMultiChoice: "0x...",    // From master deployment
    communityId: 1,                  // Usually 1 for first community
    
    // Community-specific (from create-community output)
    governor: "0x...",
    timelock: "0x...", 
    membershipToken: "0x...",
    valuableActionRegistry: "0x..."
  };

  // Validation flags
  let allValidationsPassed = true;

  const logError = (message: string) => {
    console.log(`❌ ${message}`);
    allValidationsPassed = false;
  };

  const logSuccess = (message: string) => {
    console.log(`✅ ${message}`);
  };

  // =================================================================
  // STEP 1: Validate Master Infrastructure
  // =================================================================
  
  console.log("\n=== VALIDATING MASTER INFRASTRUCTURE ===");
  
  try {
    // Check CommunityRegistry
    const communityRegistry = await ethers.getContractAt("CommunityRegistry", ADDRESSES.communityRegistry);
    const totalCommunities = await communityRegistry.getTotalCommunities();
    logSuccess(`CommunityRegistry deployed with ${totalCommunities} communities`);
    
    // Check CommunityFactory
    const communityFactory = await ethers.getContractAt("CommunityFactory", ADDRESSES.communityFactory);
    const factoryRole = await communityRegistry.hasRole(
      await communityRegistry.COMMUNITY_CREATOR_ROLE(),
      ADDRESSES.communityFactory
    );
    
    if (factoryRole) {
      logSuccess("CommunityFactory has proper permissions");
    } else {
      logError("CommunityFactory missing COMMUNITY_CREATOR_ROLE");
    }
    
    // Check CountingMultiChoice
    const countingMultiChoice = await ethers.getContractAt("CountingMultiChoice", ADDRESSES.countingMultiChoice);
    const supportsInterface = await countingMultiChoice.supportsInterface("0x01ffc9a7"); // ERC165
    
    if (supportsInterface) {
      logSuccess("CountingMultiChoice deployed correctly");
    } else {
      logError("CountingMultiChoice interface check failed");
    }
    
  } catch (error) {
    logError(`Master infrastructure validation failed: ${error}`);
  }

  // =================================================================
  // STEP 2: Validate Community Infrastructure
  // =================================================================
  
  console.log("\n=== VALIDATING COMMUNITY INFRASTRUCTURE ===");
  
  try {
    // Check Governor
    const governor = await ethers.getContractAt("ShiftGovernor", ADDRESSES.governor);
    const governorName = await governor.name();
    const votingDelay = await governor.votingDelay();
    const votingPeriod = await governor.votingPeriod();
    
    logSuccess(`Governor "${governorName}" - Delay: ${votingDelay}, Period: ${votingPeriod}`);
    
    // Check Timelock
    const timelock = await ethers.getContractAt("TimelockController", ADDRESSES.timelock);
    const minDelay = await timelock.getMinDelay();
    logSuccess(`Timelock minimum delay: ${minDelay} seconds`);
    
    // Check MembershipToken
    const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", ADDRESSES.membershipToken);
    const tokenName = await membershipToken.name();
    const tokenSymbol = await membershipToken.symbol();
    const totalSupply = await membershipToken.totalSupply();
    const founderBalance = await membershipToken.balanceOf(deployer.address);
    
    logSuccess(`MembershipToken "${tokenName}" (${tokenSymbol})`);
    logSuccess(`Total Supply: ${ethers.formatEther(totalSupply)} tokens`);
    logSuccess(`Founder Balance: ${ethers.formatEther(founderBalance)} tokens`);
    
    if (founderBalance === 0n) {
      logError("Founder has zero token balance - bootstrap may have failed");
    }
    
    // Check ValuableActionRegistry
    const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", ADDRESSES.valuableActionRegistry);
    const registryGovernance = await valuableActionRegistry.governance();
    
    if (registryGovernance === ADDRESSES.governor) {
      logSuccess("ValuableActionRegistry properly linked to Governor");
    } else {
      logError(`ValuableActionRegistry governance mismatch: ${registryGovernance} vs ${ADDRESSES.governor}`);
    }
    
  } catch (error) {
    logError(`Community infrastructure validation failed: ${error}`);
  }

  // =================================================================
  // STEP 3: Validate Community Registry Integration
  // =================================================================
  
  console.log("\n=== VALIDATING REGISTRY INTEGRATION ===");
  
  try {
    const communityRegistry = await ethers.getContractAt("CommunityRegistry", ADDRESSES.communityRegistry);
    
    // Get community details
    const community = await communityRegistry.getCommunity(ADDRESSES.communityId);
    logSuccess(`Community "${community.name}" registered with ID ${ADDRESSES.communityId}`);
    
    // Get module addresses
    const modules = await communityRegistry.getCommunityModules(ADDRESSES.communityId);
    
    const expectedModules = [
      { name: "Governor", expected: ADDRESSES.governor, actual: modules.governor },
      { name: "Timelock", expected: ADDRESSES.timelock, actual: modules.timelock },
      { name: "MembershipToken", expected: ADDRESSES.membershipToken, actual: modules.membershipToken },
      { name: "ValuableActionRegistry", expected: ADDRESSES.valuableActionRegistry, actual: modules.valuableActionRegistry }
    ];
    
    for (const module of expectedModules) {
      if (module.expected.toLowerCase() === module.actual.toLowerCase()) {
        logSuccess(`${module.name} module correctly registered`);
      } else {
        logError(`${module.name} module mismatch: expected ${module.expected}, got ${module.actual}`);
      }
    }
    
  } catch (error) {
    logError(`Registry integration validation failed: ${error}`);
  }

  // =================================================================
  // STEP 4: Validate Permissions and Roles
  // =================================================================
  
  console.log("\n=== VALIDATING PERMISSIONS ===");
  
  try {
    const timelock = await ethers.getContractAt("TimelockController", ADDRESSES.timelock);
    const governor = await ethers.getContractAt("ShiftGovernor", ADDRESSES.governor);
    
    // Check if governor is proposer on timelock
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    
    const governorIsProposer = await timelock.hasRole(PROPOSER_ROLE, ADDRESSES.governor);
    const governorIsExecutor = await timelock.hasRole(EXECUTOR_ROLE, ADDRESSES.governor);
    
    if (governorIsProposer) {
      logSuccess("Governor has PROPOSER_ROLE on Timelock");
    } else {
      logError("Governor missing PROPOSER_ROLE on Timelock");
    }
    
    if (governorIsExecutor) {
      logSuccess("Governor has EXECUTOR_ROLE on Timelock");
    } else {
      logError("Governor missing EXECUTOR_ROLE on Timelock");
    }
    
    // Check if timelock is the governor's executor
    const governorTimelock = await governor.timelock();
    
    if (governorTimelock.toLowerCase() === ADDRESSES.timelock.toLowerCase()) {
      logSuccess("Governor correctly linked to Timelock");
    } else {
      logError(`Governor timelock mismatch: ${governorTimelock} vs ${ADDRESSES.timelock}`);
    }
    
  } catch (error) {
    logError(`Permissions validation failed: ${error}`);
  }

  // =================================================================
  // STEP 5: Basic Functionality Test
  // =================================================================
  
  console.log("\n=== BASIC FUNCTIONALITY TEST ===");
  
  try {
    const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", ADDRESSES.membershipToken);
    const governor = await ethers.getContractAt("ShiftGovernor", ADDRESSES.governor);
    
    // Check voting power
    const votingPower = await membershipToken.getVotes(deployer.address);
    logSuccess(`Founder voting power: ${ethers.formatEther(votingPower)} votes`);
    
    // Check if can create proposal (just simulate, don't execute)
    const proposalThreshold = await governor.proposalThreshold();
    
    if (votingPower >= proposalThreshold) {
      logSuccess(`Founder can create proposals (has ${ethers.formatEther(votingPower)}, needs ${ethers.formatEther(proposalThreshold)})`);
    } else {
      logError(`Founder cannot create proposals (has ${ethers.formatEther(votingPower)}, needs ${ethers.formatEther(proposalThreshold)})`);
    }
    
  } catch (error) {
    logError(`Functionality test failed: ${error}`);
  }

  // =================================================================
  // VALIDATION SUMMARY
  // =================================================================
  
  console.log("\n🎯 VALIDATION SUMMARY");
  console.log("=".repeat(50));
  
  if (allValidationsPassed) {
    console.log("✅ ALL VALIDATIONS PASSED!");
    console.log("🎉 Deployment is successful and ready for use.");
    console.log("\n📋 You can now:");
    console.log("1. 👥 Distribute MembershipTokens to community members");
    console.log("2. 📝 Create ValuableActions via governance proposals");
    console.log("3. 💬 Post requests in RequestHub");
    console.log("4. 📄 Create drafts and escalate to proposals");
    console.log("5. 🗳️ Conduct governance votes");
  } else {
    console.log("❌ SOME VALIDATIONS FAILED!");
    console.log("🔧 Please review the errors above and fix issues before proceeding.");
    console.log("\n⚠️ Common issues:");
    console.log("- Incorrect contract addresses in configuration");
    console.log("- Missing role assignments");
    console.log("- Network connectivity problems");
    console.log("- Insufficient gas for transactions");
  }
  
  console.log("\n📊 Deployment Status:", allValidationsPassed ? "READY" : "NEEDS_FIX");
  
  return { 
    success: allValidationsPassed,
    addresses: ADDRESSES
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});