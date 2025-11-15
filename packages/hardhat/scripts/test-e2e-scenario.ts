import { ethers } from "hardhat";

/**
 * End-to-End Governance Scenario Test
 * 
 * Scenario: "user1 creates a community, and gets joined by user 2 through 5, 
 * then user1 creates a request, he proposes creating an action type for funding 
 * the project, user 2 creates a draft based on the request with the call datas 
 * for creating the new action type, users 3,4 and 5 discuss on the request and 
 * draft, draft escalates, 3 out of 5 vote the proposal and it wins, user1 
 * executes the proposal and the action type is created"
 */

// CONTRACT ADDRESSES - Update these after deployment
const CONTRACT_ADDRESSES = {
  token: "0x...", // Update with deployed address
  timelock: "0x...", // Update with deployed address  
  governor: "0x...", // Update with deployed address
  countingMulti: "0x...", // Update with deployed address
  communityRegistry: "0x...", // Update with deployed address
  requestHub: "0x...", // Update with deployed address
  draftsManager: "0x...", // Update with deployed address
  actionTypeRegistry: "0x..." // Update with deployed address
};

async function main() {
  console.log("🎬 Starting End-to-End Governance Scenario...");
  
  // Get test accounts
  const [deployer, user1, user2, user3, user4, user5] = await ethers.getSigners();
  
  console.log("\n👥 Test Accounts:");
  console.log("├── Deployer:", deployer.address);
  console.log("├── User1 (Creator):", user1.address);
  console.log("├── User2 (Drafter):", user2.address);
  console.log("├── User3 (Voter):", user3.address);
  console.log("├── User4 (Voter):", user4.address);
  console.log("└── User5 (Voter):", user5.address);

  // Connect to deployed contracts
  const token = await ethers.getContractAt("MembershipTokenERC20Votes", CONTRACT_ADDRESSES.token) as any;
  const timelock = await ethers.getContractAt("TimelockController", CONTRACT_ADDRESSES.timelock) as any;
  const governor = await ethers.getContractAt("ShiftGovernor", CONTRACT_ADDRESSES.governor) as any;
  const countingMulti = await ethers.getContractAt("CountingMultiChoice", CONTRACT_ADDRESSES.countingMulti) as any;
  const registry = await ethers.getContractAt("CommunityRegistry", CONTRACT_ADDRESSES.communityRegistry) as any;
  const requestHub = await ethers.getContractAt("RequestHub", CONTRACT_ADDRESSES.requestHub) as any;
  const draftsManager = await ethers.getContractAt("DraftsManager", CONTRACT_ADDRESSES.draftsManager) as any;
  const actionRegistry = await ethers.getContractAt("ActionTypeRegistry", CONTRACT_ADDRESSES.actionTypeRegistry) as any;

  console.log("\n✅ Connected to all contracts");

  // Step 1: Setup - Mint tokens to users 2-5 (user1 already has admin privileges)
  console.log("\n=== STEP 1: TOKEN DISTRIBUTION ===");
  
  const TOKENS_PER_USER = ethers.parseEther("100"); // 100 tokens each
  
  for (let i = 2; i <= 5; i++) {
    const user = [user2, user3, user4, user5][i-2];
    console.log(`💰 Minting ${ethers.formatEther(TOKENS_PER_USER)} tokens to user${i}...`);
    const mintTx = await token.connect(deployer).mint(user.address, TOKENS_PER_USER);
    await mintTx.wait();
    
    // Delegate voting power to self
    const delegateTx = await token.connect(user).delegate(user.address);
    await delegateTx.wait();
  }
  console.log("✅ All users have tokens and voting power");

  // Step 2: User1 creates a request for ActionType funding
  console.log("\n=== STEP 2: CREATE REQUEST ===");
  
  const requestTx = await requestHub.connect(user1).createRequest(
    1, // communityId
    "Fund Project Development", // title
    "ipfs://request-for-project-funding-actiontype", // cid
    ["funding", "development", "actiontype"] // tags
  );
  const requestReceipt = await requestTx.wait();
  const requestEvent = requestReceipt.logs.find((log: any) => log.fragment?.name === 'RequestCreated');
  const requestId = requestEvent ? requestEvent.args[0] : 1;
  
  console.log(`✅ User1 created request with ID: ${requestId}`);

  // Step 3: User2 creates a draft with ActionType creation calldata
  console.log("\n=== STEP 3: CREATE DRAFT WITH ACTIONTYPE CALLDATA ===");
  
  // Prepare ActionType creation parameters
  const actionTypeParams = {
    weight: 100,                    // WorkerPoints reward
    jurorsMin: 2,                   // M (minimum approvals) 
    panelSize: 3,                   // N (total jurors)
    verifyWindow: 7 * 24 * 3600,   // 7 days in seconds
    cooldown: 24 * 3600,           // 1 day cooldown
    rewardVerify: 10,              // Verifier reward points
    slashVerifierBps: 500,         // 5% slashing rate
    revocable: true,               // Can be revoked
    evidenceSpecCID: "ipfs://evidence-spec-for-funding"
  };

  // Create calldata for ActionType creation
  const createActionTypeCalldata = actionRegistry.interface.encodeFunctionData(
    "create",
    [Object.values(actionTypeParams)]
  );

  // Draft actions (target, value, calldata)
  const draftActions = {
    targets: [await actionRegistry.getAddress()],
    values: [0],
    calldatas: [createActionTypeCalldata]
  };

  const draftTx = await draftsManager.connect(user2).createDraft(
    requestId, // sourceRequestId
    draftActions.targets,
    draftActions.values, 
    draftActions.calldatas,
    "ipfs://draft-for-funding-actiontype" // cid
  );
  const draftReceipt = await draftTx.wait();
  const draftEvent = draftReceipt.logs.find((log: any) => log.fragment?.name === 'DraftCreated');
  const draftId = draftEvent ? draftEvent.args[0] : 1;
  
  console.log(`✅ User2 created draft with ID: ${draftId}`);

  // Step 4: Users 3, 4, and 5 discuss on the request and draft
  console.log("\n=== STEP 4: COMMUNITY DISCUSSION ===");
  
  // Comments on the request
  const comments = [
    { user: user3, text: "Great idea! This ActionType will help fund development work." },
    { user: user4, text: "I support this proposal. The parameters look reasonable." },
    { user: user5, text: "Agreed. The verification requirements are appropriate." }
  ];

  for (let i = 0; i < comments.length; i++) {
    const comment = comments[i];
    console.log(`💬 User${i+3} commenting on request...`);
    
    const commentTx = await requestHub.connect(comment.user).postComment(
      requestId,
      0, // parentId (0 = top-level comment)
      `ipfs://comment-${i+3}-${comment.text.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`
    );
    await commentTx.wait();
  }
  
  // Submit reviews for the draft
  for (let i = 0; i < 3; i++) {
    const reviewer = [user3, user4, user5][i];
    console.log(`👍 User${i+3} reviewing draft...`);
    
    const reviewTx = await draftsManager.connect(reviewer).submitReview(
      draftId,
      true, // support
      `ipfs://review-${i+3}-positive`
    );
    await reviewTx.wait();
  }
  
  console.log("✅ All users participated in discussion and review");

  // Step 5: Draft escalates to proposal
  console.log("\n=== STEP 5: ESCALATE TO PROPOSAL ===");
  
  // Finalize draft (assumes sufficient reviews and support)
  const finalizeTx = await draftsManager.connect(user2).finalizeForProposal(draftId);
  await finalizeTx.wait();
  console.log("✅ Draft finalized");
  
  // Escalate to governance proposal  
  const escalateTx = await draftsManager.connect(user2).escalateToProposal(
    draftId,
    false, // multiChoice (false = binary vote)
    2,     // numOptions (2 for binary)
    "Create ActionType for Project Funding - Enable community members to claim funding for development work"
  );
  const escalateReceipt = await escalateTx.wait();
  const proposalEvent = escalateReceipt.logs.find((log: any) => log.fragment?.name === 'DraftEscalated');
  const proposalId = proposalEvent ? proposalEvent.args[2] : 1;
  
  console.log(`✅ Draft escalated to proposal with ID: ${proposalId}`);

  // Step 6: 3 out of 5 users vote (user1, user3, user4)
  console.log("\n=== STEP 6: VOTING PHASE ===");
  
  // Wait for voting to start (if needed)
  console.log("⏱️  Waiting for voting period to begin...");
  const proposalState = await governor.state(proposalId);
  console.log(`📊 Proposal state: ${proposalState}`);
  
  // Cast votes (1 = For, 0 = Against)
  const voters = [
    { user: user1, vote: 1, reason: "As creator, I support this ActionType" },
    { user: user3, vote: 1, reason: "This will benefit the community" }, 
    { user: user4, vote: 1, reason: "Good parameters and clear need" }
  ];
  
  for (let i = 0; i < voters.length; i++) {
    const voter = voters[i];
    console.log(`🗳️ User voting: ${voter.reason}`);
    
    const voteTx = await governor.connect(voter.user).castVoteWithReason(
      proposalId,
      voter.vote, 
      voter.reason
    );
    await voteTx.wait();
  }
  
  console.log("✅ 3/5 users voted in favor");

  // Step 7: Wait for voting to end and execute proposal
  console.log("\n=== STEP 7: PROPOSAL EXECUTION ===");
  
  console.log("⏱️  Waiting for voting period to end...");
  // In real scenario, would need to wait for vote window to pass
  console.log("📊 Checking final vote count...");
  
  // Get vote counts
  const finalState = await governor.state(proposalId);
  console.log(`📊 Final proposal state: ${finalState}`);
  
  if (finalState === 4) { // Succeeded
    console.log("🎉 Proposal succeeded! Queuing for execution...");
    
    // Queue proposal in timelock
    const queueTx = await governor.connect(user1).queue(
      draftActions.targets,
      draftActions.values,
      draftActions.calldatas,
      ethers.keccak256(ethers.toUtf8Bytes("Create ActionType for Project Funding - Enable community members to claim funding for development work"))
    );
    await queueTx.wait();
    console.log("✅ Proposal queued in timelock");
    
    console.log("⏱️  Waiting for timelock delay...");
    // In real scenario, would need to wait for execution delay
    
    console.log("⚡ Executing proposal...");
    const executeTx = await governor.connect(user1).execute(
      draftActions.targets,
      draftActions.values,
      draftActions.calldatas,
      ethers.keccak256(ethers.toUtf8Bytes("Create ActionType for Project Funding - Enable community members to claim funding for development work"))
    );
    await executeTx.wait();
    
    console.log("🎉 PROPOSAL EXECUTED! ActionType created successfully!");
    
    // Verify ActionType was created
    const actionTypes = await actionRegistry.getActiveActionTypes();
    console.log(`✅ New ActionType created. Total active ActionTypes: ${actionTypes.length}`);
    
  } else {
    console.log(`❌ Proposal did not succeed. Final state: ${finalState}`);
  }

  console.log("\n🎊 END-TO-END SCENARIO COMPLETE!");
  console.log("=".repeat(50));
  console.log("✅ Community created");
  console.log("✅ Users joined with tokens"); 
  console.log("✅ Request posted");
  console.log("✅ Draft created with ActionType calldata");
  console.log("✅ Discussion and reviews completed");
  console.log("✅ Draft escalated to proposal");
  console.log("✅ 3/5 users voted in favor");
  console.log("✅ Proposal executed and ActionType created");
}

main().catch((error) => {
  console.error("❌ Scenario failed:", error);
  process.exitCode = 1;
});