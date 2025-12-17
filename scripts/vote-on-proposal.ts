import { ethers } from "hardhat";

const SHIFT_GOVERNOR = "0x42362f0f2Cdd96902848e21d878927234C5C9425";
const MEMBERSHIP_TOKEN = "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb";
const PROPOSAL_ID = "113920921519397733368469111639687140856855946985470387080321665420245744891488";

async function main() {
    console.log("🗳️ Cast Vote on ValuableAction Proposal - Base Sepolia");
    console.log("============================================================");
    
    const [deployer] = await ethers.getSigners();
    console.log("👤 Voting with account:", await deployer.getAddress());
    
    const shiftGovernor = await ethers.getContractAt("ShiftGovernor", SHIFT_GOVERNOR) as any;
    const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", MEMBERSHIP_TOKEN) as any;
    
    // Check proposal status
    const proposalState = await shiftGovernor.state(PROPOSAL_ID);
    const stateNames = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
    console.log("   Proposal State:", stateNames[Number(proposalState)]);
    
    if (proposalState !== 1n) {
        console.log("❌ Proposal is not active for voting yet!");
        console.log("   Current state:", stateNames[Number(proposalState)]);
        return;
    }
    
    // Check voting power
    const votingPower = await membershipToken.getVotes(await deployer.getAddress());
    console.log("   Your voting power:", ethers.formatUnits(votingPower, 18));
    
    if (votingPower === 0n) {
        console.log("❌ No voting power available!");
        return;
    }
    
    // Check if already voted
    const hasVoted = await shiftGovernor.hasVoted(PROPOSAL_ID, await deployer.getAddress());
    console.log("   Already voted:", hasVoted);
    
    if (hasVoted) {
        console.log("✅ You have already voted on this proposal!");
        return;
    }
    
    // Cast vote FOR the proposal
    console.log("\n🗳️ CASTING VOTE FOR PROPOSAL...");
    console.log("   Voting FOR (1) the ValuableAction creation");
    
    try {
        const voteTx = await shiftGovernor.castVote(PROPOSAL_ID, 1); // 1 = FOR
        console.log("   Transaction submitted:", voteTx.hash);
        
        const receipt = await voteTx.wait();
        console.log("   ✅ Vote cast successfully!");
        console.log("   Gas used:", receipt.gasUsed.toString());
        
        // Check new proposal state
        const newState = await shiftGovernor.state(PROPOSAL_ID);
        console.log("   New proposal state:", stateNames[Number(newState)]);
        
        if (newState === 4n) {
            console.log("\n🎉 PROPOSAL SUCCEEDED!");
            console.log("   The proposal has enough votes to pass!");
            console.log("   Next steps:");
            console.log("   1. Wait for voting period to end");
            console.log("   2. Queue the proposal in TimelockController");  
            console.log("   3. Execute after timelock delay");
            console.log("   4. ValuableAction will be created and ready for claims!");
        } else {
            console.log("\n⏳ Vote recorded, waiting for more votes or voting period to end");
        }
        
    } catch (error: any) {
        console.error("❌ Voting failed:", error.message);
        if (error.reason) {
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