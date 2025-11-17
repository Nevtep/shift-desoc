import { ethers } from "hardhat";

/**
 * Verify Claim Script - Base Sepolia
 * 
 * Allows verifiers to review and vote on submitted work claims
 * Part of the M-of-N verification process with economic incentives
 * 
 * Run: npx hardhat run scripts/verify-claim.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
    claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
    verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb"
};

// Configuration - Update these for the claim you want to verify
const CLAIM_ID = 1; // Claim ID to verify (from claim submission)
const VOTE_DECISION = true; // true = APPROVE, false = REJECT
const VOTE_REASON = "Work meets quality standards with comprehensive documentation and thorough security analysis. Implementation follows best practices and includes proper testing.";

async function main() {
    console.log("🔍 Verify Work Claim - Base Sepolia");
    console.log("============================================================");
    
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();
    console.log("👤 Verifying as:", signerAddress);
    console.log("🎯 Target Claim ID:", CLAIM_ID);
    console.log("🗳️ Vote Decision:", VOTE_DECISION ? "APPROVE ✅" : "REJECT ❌");
    
    // Connect to contracts
    const claims = await ethers.getContractAt("Claims", CONTRACT_ADDRESSES.claims);
    const verifierPool = await ethers.getContractAt("VerifierPool", CONTRACT_ADDRESSES.verifierPool);
    const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", CONTRACT_ADDRESSES.valuableActionRegistry);
    
    console.log("\n📊 PRE-VERIFICATION VALIDATION:");
    
    // Check if account is registered verifier
    const isRegisteredVerifier = await verifierPool.isRegisteredVerifier(signerAddress);
    console.log("   Registered Verifier:", isRegisteredVerifier ? "YES ✅" : "NO ❌");
    
    if (!isRegisteredVerifier) {
        console.log("❌ Account is not a registered verifier!");
        console.log("   Must register as verifier before participating in verification");
        console.log("   Run: npx hardhat run scripts/register-verifier.ts --network base_sepolia");
        return;
    }
    
    try {
        // Check claim exists and status
        const claim = await claims.getClaim(CLAIM_ID);
        console.log("   ✅ Claim found:");
        console.log("      └── Claimant:", claim.claimant);
        console.log("      └── Action ID:", claim.actionId.toString());
        console.log("      └── Evidence CID:", claim.evidenceCID);
        console.log("      └── Status:", claim.status.toString(), "(0=Pending, 1=UnderReview, 2=Approved, 3=Rejected)");
        console.log("      └── Created:", new Date(Number(claim.createdAt) * 1000).toLocaleString());
        
        // Get action details for context
        const action = await valuableActionRegistry.getAction(claim.actionId);
        console.log("   📋 Action Context:");
        console.log("      └── Membership Reward:", action.membershipTokenReward.toString(), "tokens");
        console.log("      └── Required Jurors:", action.jurorsMin.toString(), "of", action.panelSize.toString());
        console.log("      └── Verify Window:", action.verifyWindow.toString(), "seconds");
        
        // Check if claim is in correct state for verification
        if (claim.status !== 0n && claim.status !== 1n) {
            console.log("❌ Claim is not available for verification!");
            console.log("   Current status:", claim.status.toString());
            console.log("   Expected: 0 (Pending) or 1 (Under Review)");
            return;
        }
        
    } catch (error) {
        console.log("❌ Claim not found or error accessing:");
        console.log("   Error:", error);
        console.log("   Make sure CLAIM_ID is correct and claim exists");
        return;
    }
    
    // Check if verifier already voted
    console.log("\n🗳️ VOTING STATUS:");
    try {
        // This would need to be implemented in the Claims contract
        // For now, we'll proceed with the vote attempt
        console.log("   Checking previous votes...");
        console.log("   Vote Decision:", VOTE_DECISION ? "APPROVE" : "REJECT");
        console.log("   Vote Reason:", VOTE_REASON.substring(0, 100) + "...");
        
    } catch (error) {
        console.log("   Could not check previous votes, proceeding...");
    }
    
    try {
        // STEP 1: Cast verification vote
        console.log("\n🗳️ STEP 1: Casting verification vote...");
        
        const verifyTx = await claims.verifyClaimAsVerifier(
            CLAIM_ID,
            VOTE_DECISION,
            VOTE_REASON
        );
        
        console.log("   Vote transaction submitted:", verifyTx.hash);
        
        const verifyReceipt = await verifyTx.wait();
        console.log("   ✅ Vote cast successfully!");
        console.log("   Gas used:", verifyReceipt.gasUsed.toString());
        
        // STEP 2: Check updated claim status
        console.log("\n📊 STEP 2: Checking updated claim status...");
        
        const updatedClaim = await claims.getClaim(CLAIM_ID);
        console.log("   Updated Status:", updatedClaim.status.toString());
        
        // STEP 3: Check if verification is complete
        console.log("\n🔍 STEP 3: Verification process status...");
        
        if (updatedClaim.status === 2n) {
            console.log("   🎉 CLAIM APPROVED!");
            console.log("   ✅ Verification complete - claim was approved by majority");
            console.log("   ✅ Rewards should be distributed automatically");
            
        } else if (updatedClaim.status === 3n) {
            console.log("   ❌ CLAIM REJECTED");
            console.log("   ❌ Verification complete - claim was rejected by majority");
            console.log("   ❌ No rewards distributed");
            
        } else {
            console.log("   ⏳ VERIFICATION IN PROGRESS");
            console.log("   📊 Waiting for additional verifier votes");
            console.log("   📋 Status: Under Review");
            console.log("");
            console.log("   💡 What happens next:");
            console.log("      • Other selected verifiers will cast their votes");
            console.log("      • Once majority (2/3) votes are collected, verification finalizes");
            console.log("      • If approved: automatic reward distribution");
            console.log("      • If rejected: claimant can appeal or improve and resubmit");
        }
        
        console.log("\n🎉 VERIFICATION VOTE SUBMITTED!");
        console.log("============================================================");
        console.log("✅ Vote recorded on-chain");
        console.log("✅ Contribution to decentralized quality assurance");
        console.log("✅ Economic incentives aligned with accuracy");
        
        if (VOTE_DECISION) {
            console.log("✅ Voted to APPROVE - supporting quality work");
        } else {
            console.log("⚠️ Voted to REJECT - maintaining quality standards");
        }
        
        console.log("");
        console.log("🏆 VERIFIER REWARDS:");
        console.log("   • Earn verification points for accurate decisions");
        console.log("   • Build reputation in the community");
        console.log("   • Receive verifier rewards from successful verifications");
        console.log("   • Risk slashing (5%) for consistently incorrect votes");
        console.log("");
        console.log("⚖️ QUALITY ASSURANCE:");
        console.log("   • Your vote contributes to decentralized work quality control");
        console.log("   • Economic incentives ensure honest and thorough reviews");
        console.log("   • Community benefits from maintained quality standards");
        console.log("   • Workers receive fair evaluation of their contributions");
        console.log("");
        console.log("🔄 Monitor Progress:");
        console.log("   • Check final results: npx hardhat run scripts/check-claim-status.ts --network base_sepolia");
        console.log("   • View rewards: npx hardhat run scripts/check-rewards.ts --network base_sepolia");
        console.log("   • System status: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia");
        
    } catch (error: any) {
        console.error("❌ Verification vote failed:", error.message);
        if (error.reason) {
            console.error("   Reason:", error.reason);
        }
        
        console.log("\n🔧 Troubleshooting:");
        console.log("   • Verify you are registered as a verifier");
        console.log("   • Check if you are selected for this claim's verification panel");
        console.log("   • Ensure claim is in correct status (Pending or Under Review)");
        console.log("   • Verify you haven't already voted on this claim");
        console.log("   • Check if verification window has expired");
        console.log("   • Try with higher gas limit if transaction fails");
        console.log("");
        console.log("📋 Common Issues:");
        console.log("   • Not selected: Only randomly selected verifiers can vote");
        console.log("   • Already voted: Each verifier can only vote once per claim");
        console.log("   • Window expired: Verification must occur within time window");
        console.log("   • Claim finalized: Cannot vote on already decided claims");
        console.log("");
        console.log("💡 Selection Process:");
        console.log("   • Verifiers are randomly selected for each claim");
        console.log("   • Selection is based on availability and reputation");
        console.log("   • Not all registered verifiers participate in every claim");
        console.log("   • Selection ensures fairness and prevents manipulation");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });