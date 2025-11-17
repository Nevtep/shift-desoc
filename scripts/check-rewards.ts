import { ethers } from "hardhat";

/**
 * Check Rewards Script - Base Sepolia
 * 
 * Checks token balances and SBT rewards for completed work verification
 * Displays comprehensive reward status and transaction history
 * 
 * Run: npx hardhat run scripts/check-rewards.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
    communityToken: "0x9352b89B39D7b0e6255935A8053Df37393013371",
    workerSBT: "0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562",
    claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B"
};

// Configuration - check rewards for specific account (leave empty for current signer)
const TARGET_ADDRESS = ""; // Leave empty to check current signer's rewards

async function main() {
    console.log("🎁 Check Work Verification Rewards - Base Sepolia");
    console.log("============================================================");
    
    const [signer] = await ethers.getSigners();
    const checkAddress = TARGET_ADDRESS || await signer.getAddress();
    console.log("👤 Checking rewards for:", checkAddress);
    console.log("📅 Check Date:", new Date().toLocaleString());
    
    // Connect to contracts
    const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", CONTRACT_ADDRESSES.membershipToken);
    const communityToken = await ethers.getContractAt("CommunityToken", CONTRACT_ADDRESSES.communityToken);
    const workerSBT = await ethers.getContractAt("WorkerSBT", CONTRACT_ADDRESSES.workerSBT);
    const claims = await ethers.getContractAt("Claims", CONTRACT_ADDRESSES.claims);
    const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", CONTRACT_ADDRESSES.valuableActionRegistry);
    const verifierPool = await ethers.getContractAt("VerifierPool", CONTRACT_ADDRESSES.verifierPool);
    
    console.log("\n💰 TOKEN BALANCES:");
    console.log("=".repeat(50));
    
    // Declare variables at function scope
    let membershipBalance = 0n;
    let communityBalance = 0n;
    let sbtBalance = 0n;
    let isVerifier = false;
    
    try {
        // Check MembershipToken balance (governance tokens)
        membershipBalance = await membershipToken.balanceOf(checkAddress);
        const votingPower = await membershipToken.getVotes(checkAddress);
        console.log("🏛️ Membership Tokens (Governance):");
        console.log("   └── Balance:", ethers.formatEther(membershipBalance));
        console.log("   └── Voting Power:", ethers.formatEther(votingPower));
        console.log("   └── Purpose: Governance participation, proposal creation, voting");
        
        // Check CommunityToken balance (treasury tokens)
        communityBalance = await communityToken.balanceOf(checkAddress);
        console.log("🏪 Community Tokens (Treasury):");
        console.log("   └── Balance:", ethers.formatEther(communityBalance));
        console.log("   └── Purpose: Community treasury participation, service payments");
        
        // Check WorkerSBT balance (achievement tokens)
        sbtBalance = await workerSBT.balanceOf(checkAddress);
        console.log("🏆 Worker SBTs (Achievements):");
        console.log("   └── Balance:", sbtBalance.toString());
        console.log("   └── Purpose: Non-transferable achievement records, reputation");
        
        if (sbtBalance > 0n) {
            console.log("   └── SBT Details:");
            try {
                // Get individual SBT token IDs (if available)
                for (let i = 0; i < Math.min(Number(sbtBalance), 5); i++) {
                    try {
                        const tokenId = await workerSBT.tokenOfOwnerByIndex(checkAddress, i);
                        console.log("      └── SBT #" + tokenId.toString());
                        
                        // Get SBT metadata if available
                        try {
                            const tokenURI = await workerSBT.tokenURI(tokenId);
                            console.log("         └── URI:", tokenURI);
                        } catch (e) {
                            // tokenURI might not be implemented
                        }
                    } catch (e) {
                        console.log("      └── SBT #" + (i + 1).toString() + " (details not accessible)");
                    }
                }
                
                if (sbtBalance > 5n) {
                    console.log("      └── ... and", (Number(sbtBalance) - 5).toString(), "more SBTs");
                }
            } catch (e) {
                console.log("   └── (SBT enumeration not available)");
            }
        }
        
    } catch (error) {
        console.log("❌ Error checking token balances:", error);
    }
    
    console.log("\n📊 PARTICIPATION SUMMARY:");
    console.log("=".repeat(50));
    
    try {
        // Check verifier status
        isVerifier = await verifierPool.isRegisteredVerifier(checkAddress);
        console.log("👥 Verifier Status:", isVerifier ? "REGISTERED ✅" : "NOT REGISTERED");
        
        if (isVerifier) {
            console.log("   └── Verifier benefits active");
            console.log("   └── Eligible for verification rewards");
            console.log("   └── Participating in quality assurance");
        }
        
        // Check recent activity (simplified - would need event parsing for full history)
        console.log("📈 Activity Summary:");
        console.log("   └── Account Type:", 
            isVerifier ? "Verifier + Worker" : 
            sbtBalance > 0n ? "Worker" : 
            membershipBalance > 0n ? "Token Holder" : "New Account");
        
        if (membershipBalance > 0n) {
            console.log("   └── Governance Participation: ENABLED");
        }
        
        if (sbtBalance > 0n) {
            console.log("   └── Work Completions:", sbtBalance.toString(), "verified tasks");
        }
        
    } catch (error) {
        console.log("❌ Error checking participation status:", error);
    }
    
    console.log("\n💎 REWARD VALUE ANALYSIS:");
    console.log("=".repeat(50));
    
    try {
        // Calculate total reward value
        const totalMembership = membershipBalance;
        const totalCommunity = communityBalance;
        const totalSBTs = sbtBalance;
        
        console.log("📈 Portfolio Summary:");
        console.log("   ├── Governance Power:", ethers.formatEther(totalMembership), "votes");
        console.log("   ├── Treasury Tokens:", ethers.formatEther(totalCommunity));
        console.log("   ├── Achievement SBTs:", totalSBTs.toString());
        console.log("   └── Total Reward Items:", 
            (totalMembership > 0n ? 1 : 0) + 
            (totalCommunity > 0n ? 1 : 0) + 
            (totalSBTs > 0n ? 1 : 0));
        
        // Estimate reward sources
        if (totalSBTs > 0n) {
            const estimatedMembershipFromWork = Number(totalSBTs) * 100; // Assuming 100 per SBT
            const estimatedCommunityFromWork = Number(totalSBTs) * 50;   // Assuming 50 per SBT
            
            console.log("\n🔍 Estimated Work Rewards:");
            console.log("   ├── From Completed Tasks:", totalSBTs.toString());
            console.log("   ├── Est. Membership Earned:", estimatedMembershipFromWork.toString());
            console.log("   ├── Est. Community Earned:", estimatedCommunityFromWork.toString());
            console.log("   └── Work Value Ratio: " + 
                (totalMembership > 0n ? 
                    ((estimatedMembershipFromWork * 100) / Number(ethers.formatEther(totalMembership))).toFixed(1) + "%" : 
                    "N/A"));
        }
        
    } catch (error) {
        console.log("❌ Error calculating reward analysis:", error);
    }
    
    console.log("\n🎯 REWARD OPPORTUNITIES:");
    console.log("=".repeat(50));
    
    try {
        // Check available ValuableActions for future work
        console.log("🚀 Available Work Opportunities:");
        
        // Try to get first few actions to see what's available
        let activeActions = 0;
        for (let i = 1; i <= 5; i++) {
            try {
                const action = await valuableActionRegistry.getAction(i);
                const isActive = await valuableActionRegistry.isActive(i);
                
                if (isActive) {
                    activeActions++;
                    console.log("   ✅ Action #" + i + ":");
                    console.log("      └── Membership Reward:", action.membershipTokenReward.toString());
                    console.log("      └── Community Reward:", action.communityTokenReward.toString());
                    console.log("      └── Verification: " + action.jurorsMin.toString() + " of " + action.panelSize.toString() + " approval");
                }
            } catch (e) {
                // Action doesn't exist, continue
                break;
            }
        }
        
        if (activeActions === 0) {
            console.log("   ⏳ No active ValuableActions found");
            console.log("   💡 Actions may be created through governance proposals");
        } else {
            console.log("   📊 Total Active Actions:", activeActions);
        }
        
        // Participation recommendations
        console.log("\n💡 Participation Recommendations:");
        
        if (!isVerifier && membershipBalance >= ethers.parseEther("100")) {
            console.log("   🎯 Consider registering as verifier (100+ tokens available)");
            console.log("      └── Command: npx hardhat run scripts/register-verifier.ts --network base_sepolia");
        }
        
        if (activeActions > 0) {
            console.log("   🎯 Consider submitting work claims for available actions");
            console.log("      └── Command: npx hardhat run scripts/submit-claim.ts --network base_sepolia");
        }
        
        if (membershipBalance > 0n) {
            console.log("   🎯 Participate in governance proposals and voting");
            console.log("      └── Monitor: npx hardhat run scripts/monitor-proposal.ts --network base_sepolia");
        }
        
    } catch (error) {
        console.log("❌ Error checking opportunities:", error);
    }
    
    console.log("\n🎉 REWARD CHECK COMPLETE!");
    console.log("============================================================");
    console.log("✅ Token balances verified");
    console.log("✅ Participation status checked");
    console.log("✅ Opportunities identified");
    
    // Summary statistics
    const hasTokens = membershipBalance > 0n || communityBalance > 0n;
    const hasAchievements = sbtBalance > 0n;
    
    if (hasTokens && hasAchievements) {
        console.log("🏆 Status: ACTIVE CONTRIBUTOR - Earning rewards through verified work");
    } else if (hasTokens) {
        console.log("💰 Status: TOKEN HOLDER - Ready to participate in governance and work");
    } else if (hasAchievements) {
        console.log("🎖️ Status: VERIFIED WORKER - Completed work but minimal token rewards");
    } else {
        console.log("🌱 Status: NEW PARTICIPANT - Ready to start earning rewards");
    }
    
    console.log("");
    console.log("🔄 Regular Monitoring:");
    console.log("   • Run this script regularly to track reward accumulation");
    console.log("   • Monitor system: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia");
    console.log("   • Check proposals: npx hardhat run scripts/monitor-proposal.ts --network base_sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });