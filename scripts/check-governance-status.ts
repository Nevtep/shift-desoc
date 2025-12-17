import { ethers } from "hardhat";

const COMMUNITY_ID = 1;

// Base Sepolia deployed contract addresses
const SHIFT_GOVERNOR = "0x42362f0f2Cdd96902848e21d878927234C5C9425";
const VALUABLE_ACTION_REGISTRY = "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2";
const MEMBERSHIP_TOKEN = "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb";

// Proposal ID from previous script
const PROPOSAL_ID = "113920921519397733368469111639687140856855946985470387080321665420245744891488";

async function main() {
    console.log("🏛️ Governance Proposal Status Check - Base Sepolia");
    console.log("============================================================");
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 Using account:", await deployer.getAddress());
    
    // Get contract instances
    const shiftGovernor = await ethers.getContractAt("ShiftGovernor", SHIFT_GOVERNOR) as any;
    const valuableActionRegistry = await ethers.getContractAt("ValuableActionRegistry", VALUABLE_ACTION_REGISTRY) as any;
    const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", MEMBERSHIP_TOKEN) as any;
    
    try {
        console.log("\n📊 PROPOSAL STATUS CHECK:");
        
        // Check current proposal state
        const proposalState = await shiftGovernor.state(PROPOSAL_ID);
        const currentBlock = await ethers.provider.getBlockNumber();
        const snapshot = await shiftGovernor.proposalSnapshot(PROPOSAL_ID);
        const deadline = await shiftGovernor.proposalDeadline(PROPOSAL_ID);
        
        console.log("   Proposal ID:", PROPOSAL_ID);
        console.log("   Current state:", proposalState.toString());
        console.log("   Current block:", currentBlock);
        console.log("   Snapshot block:", snapshot.toString());
        console.log("   Deadline block:", deadline.toString());
        
        // State meanings: 0=Pending, 1=Active, 2=Canceled, 3=Defeated, 4=Succeeded, 5=Queued, 6=Expired, 7=Executed
        const stateNames = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
        console.log("   State name:", stateNames[Number(proposalState)] || "Unknown");
        
        if (proposalState === 0n) {
            console.log("\n⏳ PROPOSAL IS PENDING");
            console.log("   Waiting for voting to start at block:", snapshot.toString());
            console.log("   Blocks remaining:", Number(snapshot) - currentBlock);
            
        } else if (proposalState === 1n) {
            console.log("\n🗳️ PROPOSAL IS ACTIVE - CAN VOTE!");
            
            const votingPower = await membershipToken.getVotes(await deployer.getAddress());
            console.log("   Your voting power:", ethers.formatUnits(votingPower, 18));
            
            if (votingPower > 0n) {
                console.log("   💡 You can vote on this proposal!");
                console.log("   Voting ends at block:", deadline.toString());
                console.log("   Blocks remaining:", Number(deadline) - currentBlock);
                
                // Check if we already voted
                try {
                    const hasVoted = await shiftGovernor.hasVoted(PROPOSAL_ID, await deployer.getAddress());
                    console.log("   Already voted:", hasVoted);
                    
                    if (!hasVoted) {
                        console.log("\n🗳️ CASTING VOTE FOR PROPOSAL...");
                        const voteTx = await shiftGovernor.castVote(PROPOSAL_ID, 1); // 1 = For
                        console.log("   Transaction hash:", voteTx.hash);
                        
                        await voteTx.wait();
                        console.log("   ✅ Vote cast successfully!");
                        
                        // Check new state
                        const newState = await shiftGovernor.state(PROPOSAL_ID);
                        console.log("   New proposal state:", stateNames[Number(newState)] || "Unknown");
                    }
                } catch (e) {
                    console.log("   Error checking vote status:", (e as any).message);
                }
            }
            
        } else if (proposalState === 4n) {
            console.log("\n✅ PROPOSAL SUCCEEDED!");
            console.log("   Ready to queue and execute");
            
            // Try to queue the proposal
            console.log("\n🚀 QUEUEING PROPOSAL...");
            try {
                const targets = [VALUABLE_ACTION_REGISTRY];
                const values = [0];
                const calldatas = []; // We'll need the actual calldata
                const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("Create ValuableAction: Complete Development Task - Testing work verification system with 2-of-3 juror verification, 100 membership token reward, 1 hour cooldown"));
                
                console.log("   Note: Would queue proposal here, but need actual calldata from proposal creation");
                
            } catch (e) {
                console.log("   Queue error:", (e as any).message);
            }
            
        } else if (proposalState === 7n) {
            console.log("\n🎉 PROPOSAL EXECUTED!");
            console.log("   ValuableAction should be created");
        }
        
        console.log("\n📊 VALUABLEACTION STATUS:");
        
        const lastActionId = await valuableActionRegistry.lastId();
        console.log("   Last ValuableAction ID:", lastActionId.toString());
        
        if (lastActionId > 0n) {
            for (let i = 1; i <= Number(lastActionId); i++) {
                const actionData = await valuableActionRegistry.valuableActionsById(i);
                const isActive = await valuableActionRegistry.isActive(i);
                
                console.log(`   Action ${i}:`);
                console.log(`     Membership reward: ${actionData.membershipTokenReward}`);
                console.log(`     Community reward: ${actionData.communityTokenReward}`);
                console.log(`     Jurors min/panel: ${actionData.jurorsMin}/${actionData.panelSize}`);
                console.log(`     Is active: ${isActive}`);
                console.log(`     Title template: ${actionData.titleTemplate}`);
            }
        } else {
            console.log("   No ValuableActions created yet");
        }
        
        console.log("\n🎯 NEXT STEPS:");
        if (proposalState === 0n) {
            console.log("   Wait for voting period to start");
        } else if (proposalState === 1n) {
            console.log("   Vote on the proposal (if not already voted)");
        } else if (proposalState === 4n) {
            console.log("   Queue and execute the proposal");
        } else if (proposalState === 7n) {
            console.log("   Start testing work verification with the new ValuableAction");
        }
        
    } catch (error: any) {
        console.error("❌ Error:", error?.message || error);
        if (error?.data) {
            console.error("   Error data:", error.data);
        }
        if (error?.reason) {
            console.error("   Reason:", error.reason);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });