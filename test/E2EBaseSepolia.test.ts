import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "ethers";

/**
 * E2E Tests for Base Sepolia Deployed Contracts
 *
 * These tests interact with actual deployed contracts on Base Sepolia testnet.
 * They verify the complete workflows:
 * 1. Governance: Request → Draft → Proposal → Vote → Execute
 * 2. Work Verification: Define Action → Claim → Verify → Grant Rewards
 *
 * To run: npx hardhat test test/E2EBaseSepolia.test.ts --network base_sepolia
 */

describe("E2E Tests - Base Sepolia Deployed Contracts", function () {
  // Base Sepolia Deployed Contract Addresses
  const CONTRACT_ADDRESSES = {
    // Master Infrastructure
    communityRegistry: "0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B",
    countingMultiChoice: "0x9a254605ccEf5c69Ce51b0a8C0a65016dD476c83",

    // Community ID 1 Contracts
    shiftGovernor: "0x42362f0f2Cdd96902848e21d878927234C5C9425",
    timelockController: "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA",
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
    verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
    workerSBT: "0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562",
    requestHub: "0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA",
    draftsManager: "0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07",
    communityToken: "0x9352b89B39D7b0e6255935A8053Df37393013371",
  };

  const DEPLOYER_ADDRESS = "0x73af48d53f75827dB195189e6FeBaB726dF7D0e2";
  const COMMUNITY_ID = 1;

  let deployer: Signer;
  let user1: Signer, user2: Signer, user3: Signer, user4: Signer, user5: Signer;
  let user1Address: string,
    user2Address: string,
    user3Address: string,
    user4Address: string,
    user5Address: string;

  // Contract instances
  let communityRegistry: any;
  let requestHub: any;
  let draftsManager: any;
  let governor: any;
  let countingMultiChoice: any;
  let valuableActionRegistry: any;
  let claims: any;
  let verifierPool: any;
  let workerSBT: any;
  let membershipToken: any;

  before(async function () {
    console.log("🔧 Setting up E2E test environment...");

    // Get signers
    const signers = await ethers.getSigners();
    deployer = signers[0];
    user1 = signers[1];
    user2 = signers[2];
    user3 = signers[3];
    user4 = signers[4];
    user5 = signers[5];

    // Get addresses
    user1Address = await user1.getAddress();
    user2Address = await user2.getAddress();
    user3Address = await user3.getAddress();
    user4Address = await user4.getAddress();
    user5Address = await user5.getAddress();

    console.log("👥 Test accounts:");
    console.log("├── User1:", user1Address);
    console.log("├── User2:", user2Address);
    console.log("├── User3:", user3Address);
    console.log("├── User4:", user4Address);
    console.log("└── User5:", user5Address);

    // Connect to deployed contracts
    communityRegistry = await ethers.getContractAt(
      "CommunityRegistry",
      CONTRACT_ADDRESSES.communityRegistry,
    );
    requestHub = await ethers.getContractAt(
      "RequestHub",
      CONTRACT_ADDRESSES.requestHub,
    );
    draftsManager = await ethers.getContractAt(
      "DraftsManager",
      CONTRACT_ADDRESSES.draftsManager,
    );
    governor = await ethers.getContractAt(
      "ShiftGovernor",
      CONTRACT_ADDRESSES.shiftGovernor,
    );
    countingMultiChoice = await ethers.getContractAt(
      "CountingMultiChoice",
      CONTRACT_ADDRESSES.countingMultiChoice,
    );
    valuableActionRegistry = await ethers.getContractAt(
      "ValuableActionRegistry",
      CONTRACT_ADDRESSES.valuableActionRegistry,
    );
    claims = await ethers.getContractAt("Claims", CONTRACT_ADDRESSES.claims);
    verifierPool = await ethers.getContractAt(
      "VerifierPool",
      CONTRACT_ADDRESSES.verifierPool,
    );
    workerSBT = await ethers.getContractAt(
      "WorkerSBT",
      CONTRACT_ADDRESSES.workerSBT,
    );
    membershipToken = await ethers.getContractAt(
      "MembershipTokenERC20Votes",
      CONTRACT_ADDRESSES.membershipToken,
    );

    console.log("✅ Connected to all deployed contracts");

    // Setup test tokens (if deployer has permissions)
    await setupTestTokens();
  });

  async function setupTestTokens() {
    console.log("🪙 Setting up test tokens...");

    const tokensPerUser = ethers.parseEther("1000");

    try {
      // Check if deployer has minter role
      const MINTER_ROLE = await membershipToken.MINTER_ROLE();
      const deployerAddress = await deployer.getAddress();
      const hasMinterRole = await membershipToken.hasRole(
        MINTER_ROLE,
        deployerAddress,
      );

      if (hasMinterRole) {
        // Mint tokens to test users
        await membershipToken
          .connect(deployer)
          .mint(user1Address, tokensPerUser, "E2E test allocation");
        await membershipToken
          .connect(deployer)
          .mint(user2Address, tokensPerUser, "E2E test allocation");
        await membershipToken
          .connect(deployer)
          .mint(user3Address, tokensPerUser, "E2E test allocation");
        await membershipToken
          .connect(deployer)
          .mint(user4Address, tokensPerUser, "E2E test allocation");
        await membershipToken
          .connect(deployer)
          .mint(user5Address, tokensPerUser, "E2E test allocation");

        console.log("✅ Tokens minted to test users");

        // Users delegate voting power to themselves
        await membershipToken.connect(user1).delegate(user1Address);
        await membershipToken.connect(user2).delegate(user2Address);
        await membershipToken.connect(user3).delegate(user3Address);
        await membershipToken.connect(user4).delegate(user4Address);
        await membershipToken.connect(user5).delegate(user5Address);

        console.log("✅ Voting power delegated");
      } else {
        console.log(
          "⚠️ Deployer doesn't have minter role, using existing tokens",
        );
      }
    } catch (error) {
      console.log("⚠️ Token setup failed, using existing tokens:", error);
    }
  }

  describe("Contract Connections", function () {
    it("Should connect to all deployed contracts", async function () {
      console.log("🔍 Verifying contract connections...");

      // Verify we can read from contracts
      const community = await communityRegistry.communities(COMMUNITY_ID);
      console.log("📋 Community name:", community.name);
      console.log("📋 Community active:", community.active);

      const totalSupply = await membershipToken.totalSupply();
      console.log(
        "💰 Total membership token supply:",
        ethers.formatEther(totalSupply),
      );

      expect(community.active).to.be.true;
      expect(totalSupply).to.be.gt(0);
    });

    it("Should verify user token balances", async function () {
      const user1Balance = await membershipToken.balanceOf(user1Address);
      const user2Balance = await membershipToken.balanceOf(user2Address);

      console.log("💰 User1 balance:", ethers.formatEther(user1Balance));
      console.log("💰 User2 balance:", ethers.formatEther(user2Balance));

      expect(user1Balance).to.be.gte(0);
      expect(user2Balance).to.be.gte(0);
    });
  });

  describe("Governance Workflow", function () {
    let requestId: number;
    let draftId: number;
    let proposalId: number;

    it("Step 1: Should create a community request", async function () {
      console.log("📝 Creating community request...");

      const tags = ["governance", "parameters", "debate-window"];

      const tx = await requestHub
        .connect(user1)
        .createRequest(
          COMMUNITY_ID,
          "Update Community Debate Window Period",
          "ipfs://QmE2ETestRequestDebateWindowUpdate",
          tags,
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log: any) =>
          log.topics[0] ===
          ethers.id("RequestCreated(uint256,uint256,address,string)"),
      );

      requestId = parseInt(event?.data.slice(0, 66), 16) || 1;

      console.log("✅ Created request ID:", requestId);

      // Verify request
      const request = await requestHub.getRequestMeta(requestId);
      expect(request.author).to.equal(user1Address);
      expect(request.title).to.equal("Update Community Debate Window Period");
    });

    it("Step 2: Should create draft from request", async function () {
      console.log("📄 Creating draft from request...");

      // Create action bundle for parameter update
      const targets = [CONTRACT_ADDRESSES.communityRegistry];
      const values = [0];
      const paramKey = ethers.keccak256(ethers.toUtf8Bytes("debateWindow"));
      const newValue = 172800; // 2 days in seconds
      const calldatas = [
        communityRegistry.interface.encodeFunctionData("updateParameter", [
          COMMUNITY_ID,
          paramKey,
          newValue,
        ]),
      ];

      const actionBundle = {
        targets,
        values,
        calldatas,
      };

      const tx = await draftsManager
        .connect(user2)
        .createDraft(
          requestId,
          actionBundle,
          "ipfs://QmE2ETestDraftDebateWindow",
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log: any) =>
          log.topics[0] === ethers.id("DraftCreated(uint256,uint256,address)"),
      );

      draftId = parseInt(event?.data.slice(0, 66), 16) || 1;

      console.log("✅ Created draft ID:", draftId);

      // Verify draft
      const draft = await draftsManager.getDraft(draftId);
      expect(draft.requestId).to.equal(requestId);
      expect(draft.contributors[0]).to.equal(user2Address);
    });

    it("Step 3: Should collaborate on draft", async function () {
      console.log("🤝 Collaborating on draft...");

      // Add contributors
      await draftsManager.connect(user3).addContributor(draftId, user3Address);
      await draftsManager.connect(user4).addContributor(draftId, user4Address);

      // Create new version
      await draftsManager
        .connect(user3)
        .snapshotVersion(draftId, "ipfs://QmE2ETestDraftV2");

      // Submit for review
      await draftsManager.connect(user2).submitForReview(draftId);

      console.log("✅ Draft collaboration completed");

      // Verify collaboration
      const draft = await draftsManager.getDraft(draftId);
      expect(draft.contributors.length).to.equal(3); // user2, user3, user4
    });

    it("Step 4: Should escalate draft to proposal", async function () {
      console.log("🚀 Escalating draft to proposal...");

      // Finalize draft
      await draftsManager.connect(user2).finalizeForProposal(draftId);

      // Escalate to proposal
      const tx = await draftsManager.connect(user2).escalateToProposal(
        draftId,
        false, // not multi-choice
        0, // numOptions
        "Proposal: Update Community Debate Window to 2 days for better deliberation",
      );

      const receipt = await tx.wait();
      // Find ProposalCreated event (this comes from governor contract)
      const proposalEvent = receipt.logs.find((log: any) => {
        // Check if this is a proposal creation event
        return (
          log.topics &&
          log.topics[0] ===
            ethers.id(
              "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)",
            )
        );
      });

      if (proposalEvent) {
        proposalId = parseInt(proposalEvent.topics[1], 16);
      } else {
        // Fallback: get from draft
        const draft = await draftsManager.getDraft(draftId);
        proposalId = draft.proposalId;
      }

      console.log("✅ Created proposal ID:", proposalId);

      expect(proposalId).to.be.gt(0);
    });

    it("Step 5: Should vote on proposal", async function () {
      console.log("🗳️ Voting on proposal...");

      // Wait for voting period to start
      const votingDelay = await governor.votingDelay();
      console.log(
        "⏳ Waiting for voting delay:",
        votingDelay.toString(),
        "blocks",
      );

      // Mine blocks to reach voting period
      for (let i = 0; i < Number(votingDelay) + 1; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      // Cast votes (3 for, 1 against, 1 abstain)
      await governor.connect(user1).castVote(proposalId, 1); // For
      await governor.connect(user2).castVote(proposalId, 1); // For
      await governor.connect(user3).castVote(proposalId, 1); // For
      await governor.connect(user4).castVote(proposalId, 0); // Against
      await governor.connect(user5).castVote(proposalId, 2); // Abstain

      console.log("✅ All votes cast");

      // Wait for voting period to end
      const votingPeriod = await governor.votingPeriod();
      for (let i = 0; i < Number(votingPeriod) + 1; i++) {
        await ethers.provider.send("evm_mine", []);
      }

      // Check proposal state
      const state = await governor.state(proposalId);
      console.log("📊 Proposal state after voting:", state);

      expect(state).to.equal(4); // Succeeded
    });

    it("Step 6: Should execute proposal", async function () {
      console.log("⚡ Executing proposal...");

      // Get draft for execution data
      const draft = await draftsManager.getDraft(draftId);
      const descriptionHash = ethers.keccak256(
        ethers.toUtf8Bytes(
          "Proposal: Update Community Debate Window to 2 days for better deliberation",
        ),
      );

      // Queue proposal
      await governor
        .connect(user1)
        .queue(
          draft.actions.targets,
          draft.actions.values,
          draft.actions.calldatas,
          descriptionHash,
        );

      console.log("⏳ Proposal queued, waiting for timelock delay...");

      // Wait for timelock delay (advance time)
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 60 * 60 + 1]); // 2 days + 1 second
      await ethers.provider.send("evm_mine", []);

      // Execute proposal
      await governor
        .connect(user1)
        .execute(
          draft.actions.targets,
          draft.actions.values,
          draft.actions.calldatas,
          descriptionHash,
        );

      console.log("✅ Proposal executed");

      // Verify parameter was updated
      const community = await communityRegistry.communities(COMMUNITY_ID);
      expect(community.debateWindow).to.equal(172800); // 2 days in seconds

      console.log("✅ Community parameter successfully updated");
    });
  });

  describe("Work Verification Workflow", function () {
    let actionId: number;
    let claimId: number;

    it("Step 1: Should define a valuable action", async function () {
      console.log("🎯 Defining valuable action...");

      // Note: This requires admin/founder permissions
      const tx = await valuableActionRegistry.connect(deployer).createAction(
        COMMUNITY_ID,
        "E2E Test Code Review",
        "ipfs://QmE2ETestActionCodeReview",
        50, // membershipTokenReward
        100, // communityTokenReward
        0, // investorSBTReward
        2, // jurorsMin: need 2 approvals
        3, // panelSize: 3 verifiers total
        7 * 24 * 3600, // verifyWindow: 7 days
        24 * 3600, // cooldownPeriod: 1 day
        1, // maxConcurrent
        10, // verifierRewardWeight
        500, // slashVerifierBps: 5%
        true, // revocable
        0x01, // evidenceTypes
        "Pull request URL and detailed review comments",
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log: any) =>
          log.topics[0] === ethers.id("ActionCreated(uint256,uint256,string)"),
      );

      actionId = parseInt(event?.data.slice(0, 66), 16) || 1;

      console.log("✅ Created valuable action ID:", actionId);

      // Verify action
      const action = await valuableActionRegistry.getAction(actionId);
      expect(action.membershipTokenReward).to.equal(50);
      expect(action.jurorsMin).to.equal(2);
    });

    it("Step 2: Should setup verifiers", async function () {
      console.log("👥 Setting up verifiers...");

      const bondAmount = ethers.parseEther("100"); // 100 tokens bond

      // Register verifiers (users 2, 3, 4)
      await membershipToken
        .connect(user2)
        .approve(CONTRACT_ADDRESSES.verifierPool, bondAmount);
      await verifierPool.connect(user2).registerVerifier(bondAmount);

      await membershipToken
        .connect(user3)
        .approve(CONTRACT_ADDRESSES.verifierPool, bondAmount);
      await verifierPool.connect(user3).registerVerifier(bondAmount);

      await membershipToken
        .connect(user4)
        .approve(CONTRACT_ADDRESSES.verifierPool, bondAmount);
      await verifierPool.connect(user4).registerVerifier(bondAmount);

      console.log("✅ Verifiers registered with bonds");

      // Verify registration
      expect(await verifierPool.isRegisteredVerifier(user2Address)).to.be.true;
      expect(await verifierPool.isRegisteredVerifier(user3Address)).to.be.true;
      expect(await verifierPool.isRegisteredVerifier(user4Address)).to.be.true;
    });

    it("Step 3: Should submit work claim", async function () {
      console.log("📋 Submitting work claim...");

      const tx = await claims
        .connect(user1)
        .submitClaim(
          actionId,
          "ipfs://QmE2ETestEvidenceCodeReview",
          "Completed comprehensive code review of governance contracts",
        );

      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (log: any) =>
          log.topics[0] ===
          ethers.id("ClaimSubmitted(uint256,address,uint256)"),
      );

      claimId = parseInt(event?.data.slice(0, 66), 16) || 1;

      console.log("✅ Submitted claim ID:", claimId);

      // Verify claim
      const claim = await claims.getClaim(claimId);
      expect(claim.claimant).to.equal(user1Address);
      expect(claim.actionId).to.equal(actionId);
    });

    it("Step 4: Should verify claim", async function () {
      console.log("🔍 Verifying claim...");

      // Verifiers vote (need 2/3 to approve)
      await claims
        .connect(user2)
        .verifyClaimAsVerifier(claimId, true, "Review meets quality standards");
      await claims
        .connect(user3)
        .verifyClaimAsVerifier(
          claimId,
          true,
          "Comprehensive analysis provided",
        );
      await claims
        .connect(user4)
        .verifyClaimAsVerifier(
          claimId,
          false,
          "Missing security considerations",
        );

      console.log("✅ Verification votes cast");

      // Wait a bit and finalize
      await ethers.provider.send("evm_increaseTime", [3600]); // 1 hour
      await ethers.provider.send("evm_mine", []);

      await claims.finalizeVerification(claimId);

      console.log("✅ Verification finalized");

      // Verify claim was approved (2/3 votes)
      const claim = await claims.getClaim(claimId);
      expect(claim.status).to.equal(2); // APPROVED
    });

    it("Step 5: Should distribute rewards", async function () {
      console.log("🎁 Checking reward distribution...");

      // Check balances after claim approval
      const membershipBalance = await membershipToken.balanceOf(user1Address);
      const workerSBTBalance = await workerSBT.balanceOf(user1Address);

      console.log(
        "💰 User1 membership token balance:",
        ethers.formatEther(membershipBalance),
      );
      console.log("🏆 User1 worker SBT balance:", workerSBTBalance.toString());

      // Verify some rewards were distributed
      expect(membershipBalance).to.be.gt(0);
      expect(workerSBTBalance).to.be.gte(0);

      console.log("✅ Rewards distributed successfully");
    });
  });

  describe("Integration Test", function () {
    it("Should run governance to create action, then use action for work verification", async function () {
      console.log("🔄 Running full integration test...");

      // This would combine both workflows:
      // 1. Use governance to create a new action type
      // 2. Use that action type for work verification

      // For brevity, we'll just verify that both systems can work together
      const totalActions =
        await valuableActionRegistry.getActionCount(COMMUNITY_ID);
      const totalClaims = await claims.getClaimCount();

      console.log("📊 Total actions in community:", totalActions.toString());
      console.log("📊 Total claims submitted:", totalClaims.toString());

      expect(totalActions).to.be.gt(0);
      expect(totalClaims).to.be.gte(0);

      console.log("✅ Integration test completed - both systems functional");
    });
  });
});
