import { ethers } from "hardhat";

const SHIFT_GOVERNOR = "0x42362f0f2Cdd96902848e21d878927234C5C9425";
const PROPOSAL_ID = "113920921519397733368469111639687140856855946985470387080321665420245744891488";

async function main() {
    console.log("📊 Governance Proposal Monitor - Base Sepolia");
    console.log("============================================================");
    console.log("Proposal ID:", PROPOSAL_ID.substring(0, 20) + "...");
    
    const shiftGovernor = await ethers.getContractAt("ShiftGovernor", SHIFT_GOVERNOR) as any;
    
    const currentBlock = await ethers.provider.getBlockNumber();
    const proposalState = await shiftGovernor.state(PROPOSAL_ID);
    const snapshot = await shiftGovernor.proposalSnapshot(PROPOSAL_ID);
    const deadline = await shiftGovernor.proposalDeadline(PROPOSAL_ID);
    
    const stateNames = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
    const stateName = stateNames[Number(proposalState)] || "Unknown";
    
    console.log("\n🎯 CURRENT STATUS:");
    console.log("   Current Block:", currentBlock);
    console.log("   Proposal State:", proposalState.toString(), "(" + stateName + ")");
    console.log("   Voting Starts:", snapshot.toString());
    console.log("   Voting Ends:", deadline.toString());
    
    if (proposalState === 0n) {
        const blocksUntilVoting = Number(snapshot) - currentBlock;
        const hoursUntilVoting = (blocksUntilVoting * 2) / 3600; // Base: ~2 seconds per block
        
        console.log("\n⏳ WAITING FOR VOTING:");
        console.log("   Blocks until voting:", blocksUntilVoting);
        console.log("   Estimated hours:", hoursUntilVoting.toFixed(1));
        console.log("   Status: PENDING - Keep monitoring!");
        
    } else if (proposalState === 1n) {
        const blocksUntilDeadline = Number(deadline) - currentBlock;
        const hoursUntilDeadline = (blocksUntilDeadline * 2) / 3600;
        
        console.log("\n🗳️ VOTING IS ACTIVE:");
        console.log("   Blocks remaining:", blocksUntilDeadline);
        console.log("   Estimated hours left:", hoursUntilDeadline.toFixed(1));
        console.log("   Status: READY TO VOTE!");
        
        // Check if we already voted
        const [deployer] = await ethers.getSigners();
        const hasVoted = await shiftGovernor.hasVoted(PROPOSAL_ID, await deployer.getAddress());
        console.log("   Already voted:", hasVoted);
        
        if (!hasVoted) {
            console.log("\n💡 ACTION NEEDED: Cast your vote!");
            console.log("   Run: npx hardhat run scripts/vote-on-proposal.ts --network base_sepolia");
        }
        
    } else if (proposalState === 4n) {
        console.log("\n✅ PROPOSAL SUCCEEDED:");
        console.log("   Status: Ready to queue and execute!");
        console.log("   Next: Queue → Execute → Create ValuableAction");
        
    } else if (proposalState === 7n) {
        console.log("\n🎉 PROPOSAL EXECUTED:");
        console.log("   ValuableAction should be created!");
        console.log("   Next: Test work verification workflow");
    }
    
    console.log("\n🔄 Monitor again with:");
    console.log("   npx hardhat run scripts/monitor-proposal.ts --network base_sepolia");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });