// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/modules/RequestHub.sol";
import "../contracts/modules/DraftsManager.sol";
import "../contracts/core/ShiftGovernor.sol";
import "../contracts/core/CountingMultiChoice.sol";
import "../contracts/modules/ValuableActionRegistry.sol";
import "../contracts/modules/Claims.sol";
import "../contracts/modules/VerifierPool.sol";
import "../contracts/tokens/WorkerSBT.sol";
import "../contracts/tokens/MembershipTokenERC20Votes.sol";
import "../contracts/modules/CommunityRegistry.sol";

/**
 * @title E2E Tests for Base Sepolia Deployed Contracts
 * @dev Comprehensive end-to-end tests that interact with actual deployed contracts on Base Sepolia testnet
 * 
 * Tests cover two main workflows:
 * 1. Governance: Request → Draft → Proposal → Vote → Execute
 * 2. Work Verification: Define Action → Claim → Verify → Grant Rewards
 * 
 * NOTE: These tests are designed to run against live testnet contracts.
 * Update RPC_URL to Base Sepolia endpoint before running.
 */
contract E2EBaseSepolia is Test {
    
    // =================================================================
    // BASE SEPOLIA DEPLOYED CONTRACT ADDRESSES
    // =================================================================
    
    // Master Infrastructure
    address constant COMMUNITY_REGISTRY = 0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B;
    address constant COUNTING_MULTI_CHOICE = 0x9a254605ccEf5c69Ce51b0a8C0a65016dD476c83;
    
    // Community ID 1 Contracts
    address constant SHIFT_GOVERNOR = 0x42362f0f2Cdd96902848e21d878927234C5C9425;
    address constant TIMELOCK_CONTROLLER = 0xF140d690BadDf50C3a1006AD587298Eed61ADCfA;
    address constant MEMBERSHIP_TOKEN = 0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb;
    address constant VALUABLE_ACTION_REGISTRY = 0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2;
    address constant CLAIMS = 0xcd3fEfEE2dd2F3114742893f86D269740DF68B35;
    address constant VERIFIER_POOL = 0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B;
    address constant WORKER_SBT = 0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562;
    address constant REQUEST_HUB = 0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA;
    address constant DRAFTS_MANAGER = 0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07;
    address constant COMMUNITY_TOKEN = 0x9352b89B39D7b0e6255935A8053Df37393013371;
    
    // Known deployer address from deployment logs
    address constant DEPLOYER = 0x73af48d53f75827dB195189e6FeBaB726dF7D0e2;
    
    // Community ID used in tests
    uint256 constant COMMUNITY_ID = 1;
    
    // Contract instances
    CommunityRegistry communityRegistry;
    RequestHub requestHub;
    DraftsManager draftsManager;
    ShiftGovernor governor;
    CountingMultiChoice countingMultiChoice;
    ValuableActionRegistry valuableActionRegistry;
    Claims claims;
    VerifierPool verifierPool;
    WorkerSBT workerSBT;
    MembershipTokenERC20Votes membershipToken;
    
    // Test accounts (we'll use these for multi-user scenarios)
    address user1;
    address user2; 
    address user3;
    address user4;
    address user5;
    
    function setUp() public {
        // Set up fork of Base Sepolia at a specific block
        string memory baseSepolia = vm.envString("BASE_SEPOLIA_RPC_URL");
        vm.createSelectFork(baseSepolia);
        
        // Connect to deployed contracts
        communityRegistry = CommunityRegistry(COMMUNITY_REGISTRY);
        requestHub = RequestHub(REQUEST_HUB);
        draftsManager = DraftsManager(DRAFTS_MANAGER);
        governor = ShiftGovernor(payable(SHIFT_GOVERNOR));
        countingMultiChoice = CountingMultiChoice(COUNTING_MULTI_CHOICE);
        valuableActionRegistry = ValuableActionRegistry(VALUABLE_ACTION_REGISTRY);
        claims = Claims(CLAIMS);
        verifierPool = VerifierPool(VERIFIER_POOL);
        workerSBT = WorkerSBT(WORKER_SBT);
        membershipToken = MembershipTokenERC20Votes(MEMBERSHIP_TOKEN);
        
        // Generate test accounts
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        user4 = makeAddr("user4");
        user5 = makeAddr("user5");
        
        // Give test accounts some ETH for transactions
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);
        vm.deal(user5, 10 ether);
        
        // Mint membership tokens to test accounts (using deployer permissions)
        _setupTestTokens();
    }
    
    function _setupTestTokens() internal {
        vm.startPrank(DEPLOYER);
        
        uint256 tokensPerUser = 1000 ether;
        
        // Mint tokens to test users
        membershipToken.mint(user1, tokensPerUser, "E2E test allocation");
        membershipToken.mint(user2, tokensPerUser, "E2E test allocation");
        membershipToken.mint(user3, tokensPerUser, "E2E test allocation");
        membershipToken.mint(user4, tokensPerUser, "E2E test allocation");
        membershipToken.mint(user5, tokensPerUser, "E2E test allocation");
        
        vm.stopPrank();
        
        // Each user delegates voting power to themselves
        vm.prank(user1);
        membershipToken.delegate(user1);
        
        vm.prank(user2);
        membershipToken.delegate(user2);
        
        vm.prank(user3);
        membershipToken.delegate(user3);
        
        vm.prank(user4);
        membershipToken.delegate(user4);
        
        vm.prank(user5);
        membershipToken.delegate(user5);
        
        // Advance block to make voting power active
        vm.roll(block.number + 1);
    }
    
    // =================================================================
    // WORKFLOW 1: GOVERNANCE PIPELINE TESTS
    // Request → Draft → Proposal → Vote → Execute
    // =================================================================
    
    /**
     * @dev Test the complete governance workflow from community discussion to execution
     */
    function testGovernanceWorkflow_RequestToDraftToProposalToExecution() public {
        console.log("=== TESTING GOVERNANCE WORKFLOW ===");
        
        // Step 1: User1 creates a request for a new community feature
        console.log("Step 1: Creating request...");
        uint256 requestId = _createCommunityRequest();
        
        // Step 2: User2 creates a draft based on the request
        console.log("Step 2: Creating draft...");
        uint256 draftId = _createDraftFromRequest(requestId);
        
        // Step 3: Community discusses and collaborates on the draft
        console.log("Step 3: Community collaboration...");
        _collaborateOnDraft(draftId);
        
        // Step 4: Draft escalates to formal governance proposal
        console.log("Step 4: Escalating to proposal...");
        uint256 proposalId = _escalateDraftToProposal(draftId);
        
        // Step 5: Community votes on the proposal
        console.log("Step 5: Voting on proposal...");
        _voteOnProposal(proposalId);
        
        // Step 6: Proposal execution (if passed)
        console.log("Step 6: Executing proposal...");
        _executeProposal(proposalId);
        
        console.log("✅ Governance workflow completed successfully");
    }
    
    function _createCommunityRequest() internal returns (uint256) {
        vm.prank(user1);
        
        string[] memory tags = new string[](3);
        tags[0] = "governance";
        tags[1] = "feature";
        tags[2] = "community";
        
        // Create request for adding a new community parameter
        uint256 requestId = requestHub.createRequest(
            COMMUNITY_ID,
            "Update Community Debate Window",
            "ipfs://QmE2ETestRequestForDebateWindowUpdate",
            tags
        );
        
        // Verify request was created
        RequestHub.RequestMeta memory request = requestHub.getRequestMeta(requestId);
        assertEq(request.author, user1);
        assertEq(request.title, "Update Community Debate Window");
        assert(request.status == RequestHub.Status.OPEN_DEBATE);
        
        console.log("Created request ID:", requestId);
        return requestId;
    }
    
    function _createDraftFromRequest(uint256 requestId) internal returns (uint256) {
        vm.prank(user2);
        
        // Create action bundle for updating debate window via governance
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = COMMUNITY_REGISTRY;
        values[0] = 0;
        
        // Encode call to update debate window to 2 days (172800 seconds)
        bytes32 paramKey = keccak256("debateWindow");
        calldatas[0] = abi.encodeWithSelector(
            CommunityRegistry.updateParameter.selector,
            COMMUNITY_ID,
            paramKey,
            172800
        );
        
        DraftsManager.ActionBundle memory actionBundle = DraftsManager.ActionBundle({
            targets: targets,
            values: values,
            calldatas: calldatas
        });
        
        uint256 draftId = draftsManager.createDraft(
            requestId,
            actionBundle,
            "ipfs://QmE2ETestDraftForDebateWindow"
        );
        
        // Verify draft was created and linked to request
        DraftsManager.Draft memory draft = draftsManager.getDraft(draftId);
        assertEq(draft.requestId, requestId);
        assertEq(draft.contributors.length, 1);
        assertEq(draft.contributors[0], user2);
        assert(draft.status == DraftsManager.DraftStatus.DRAFTING);
        
        console.log("Created draft ID:", draftId);
        return draftId;
    }
    
    function _collaborateOnDraft(uint256 draftId) internal {
        // User3 and User4 provide feedback and contribute to the draft
        vm.prank(user3);
        draftsManager.addContributor(draftId, user3);
        
        vm.prank(user4);
        draftsManager.addContributor(draftId, user4);
        
        // Create a new version with improvements
        vm.prank(user3);
        draftsManager.snapshotVersion(draftId, "ipfs://QmE2ETestDraftV2WithImprovements");
        
        // Submit for community review
        vm.prank(user2); // Original author submits for review
        draftsManager.submitForReview(draftId);
        
        // Verify collaboration occurred
        DraftsManager.Draft memory draft = draftsManager.getDraft(draftId);
        assertEq(draft.contributors.length, 3); // user2, user3, user4
        assert(draft.status == DraftsManager.DraftStatus.REVIEW);
    }
    
    function _escalateDraftToProposal(uint256 draftId) internal returns (uint256) {
        // Finalize draft for proposal submission
        vm.prank(user2);
        draftsManager.finalizeForProposal(draftId);
        
        // Escalate to formal governance proposal (binary vote in this case)
        vm.prank(user2);
        uint256 proposalId = draftsManager.escalateToProposal(
            draftId,
            false, // not multi-choice
            0,     // numOptions (not used for binary)
            "Proposal: Update Community Debate Window to 2 days for better deliberation"
        );
        
        // Verify proposal was created
        assertGt(proposalId, 0);
        
        // Check draft status updated
        DraftsManager.Draft memory draft = draftsManager.getDraft(draftId);
        assert(draft.status == DraftsManager.DraftStatus.ESCALATED);
        assertEq(draft.proposalId, proposalId);
        
        console.log("Created proposal ID:", proposalId);
        return proposalId;
    }
    
    function _voteOnProposal(uint256 proposalId) internal {
        // Wait for voting period to start
        vm.roll(block.number + governor.votingDelay() + 1);
        
        // Users vote on the proposal (3 in favor, 1 against, 1 abstain)
        vm.prank(user1);
        governor.castVote(proposalId, 1); // For
        
        vm.prank(user2);
        governor.castVote(proposalId, 1); // For
        
        vm.prank(user3);
        governor.castVote(proposalId, 1); // For
        
        vm.prank(user4);
        governor.castVote(proposalId, 0); // Against
        
        vm.prank(user5);
        governor.castVote(proposalId, 2); // Abstain
        
        // Wait for voting period to end
        vm.roll(block.number + governor.votingPeriod() + 1);
        
        // Verify proposal succeeded
        uint8 proposalState = uint8(governor.state(proposalId));
        console.log("Proposal state after voting:", proposalState);
        
        // State 4 = Succeeded
        assertEq(proposalState, 4, "Proposal should have succeeded");
    }
    
    function _executeProposal(uint256 proposalId) internal {
        // Queue the proposal for execution
        DraftsManager.Draft memory draft = draftsManager.getDraft(1); // Assuming first draft
        
        bytes32 descriptionHash = keccak256(
            bytes("Proposal: Update Community Debate Window to 2 days for better deliberation")
        );
        
        vm.prank(user1);
        governor.queue(
            draft.actions.targets,
            draft.actions.values,
            draft.actions.calldatas,
            descriptionHash
        );
        
        // Wait for timelock delay
        vm.warp(block.timestamp + 2 days + 1);
        
        // Execute the proposal
        vm.prank(user1);
        governor.execute(
            draft.actions.targets,
            draft.actions.values,
            draft.actions.calldatas,
            descriptionHash
        );
        
        // Verify the parameter was actually updated
        CommunityRegistry.Community memory community = communityRegistry.communities(COMMUNITY_ID);
        assertEq(community.debateWindow, 172800, "Debate window should be updated to 2 days");
        
        console.log("✅ Proposal executed and parameter updated");
    }
    
    // =================================================================
    // WORKFLOW 2: WORK VERIFICATION TESTS  
    // Define Action → Claim → Verify → Grant Rewards
    // =================================================================
    
    /**
     * @dev Test the complete work verification workflow
     */
    function testWorkVerificationWorkflow_DefineActionToClaimToRewards() public {
        console.log("=== TESTING WORK VERIFICATION WORKFLOW ===");
        
        // Step 1: Community defines a new valuable action type
        console.log("Step 1: Defining valuable action...");
        uint256 actionId = _defineValuableAction();
        
        // Step 2: User registers as verifier
        console.log("Step 2: Setting up verifiers...");
        _setupVerifiers();
        
        // Step 3: User submits claim for work completed
        console.log("Step 3: Submitting work claim...");
        uint256 claimId = _submitWorkClaim(actionId);
        
        // Step 4: Verifiers review and vote on claim
        console.log("Step 4: Verifying claim...");
        _verifyClaim(claimId);
        
        // Step 5: Claim approval and reward distribution
        console.log("Step 5: Distributing rewards...");
        _distributeRewards(claimId);
        
        console.log("✅ Work verification workflow completed successfully");
    }
    
    function _defineValuableAction() internal returns (uint256) {
        vm.prank(DEPLOYER); // Using deployer with admin privileges
        
        uint256 actionId = valuableActionRegistry.createAction(
            COMMUNITY_ID,
            "Code Review Completion",
            "ipfs://QmE2ETestActionCodeReview",
            50,    // membershipTokenReward: 50 governance tokens
            100,   // communityTokenReward: 100 community tokens  
            0,     // investorSBTReward: 0 (not an investment action)
            2,     // jurorsMin: need 2 approvals
            3,     // panelSize: 3 verifiers total
            7 days, // verifyWindow: 7 days to complete verification
            1 days, // cooldownPeriod: 1 day between claims
            1,     // maxConcurrent: 1 active claim at a time
            10,    // verifierRewardWeight: 10 points for verifiers
            500,   // slashVerifierBps: 5% slashing for incorrect verification
            true,  // revocable: community can revoke if needed
            0x01,  // evidenceTypes: basic documentation required
            "Pull Request URL and Review Comments" // evidenceSpec
        );
        
        // Verify action was created
        ValuableActionRegistry.ValuableAction memory action = valuableActionRegistry.getAction(actionId);
        assertEq(action.membershipTokenReward, 50);
        assertEq(action.jurorsMin, 2);
        assertEq(action.panelSize, 3);
        
        console.log("Created valuable action ID:", actionId);
        return actionId;
    }
    
    function _setupVerifiers() internal {
        // Users 2, 3, and 4 register as verifiers with bonding
        uint256 bondAmount = 100 ether; // 100 membership tokens as bond
        
        // Give verifier pool the necessary approvals first
        vm.prank(user2);
        membershipToken.approve(VERIFIER_POOL, bondAmount);
        vm.prank(user2);
        verifierPool.registerVerifier(bondAmount);
        
        vm.prank(user3);
        membershipToken.approve(VERIFIER_POOL, bondAmount);
        vm.prank(user3);
        verifierPool.registerVerifier(bondAmount);
        
        vm.prank(user4);
        membershipToken.approve(VERIFIER_POOL, bondAmount);
        vm.prank(user4);
        verifierPool.registerVerifier(bondAmount);
        
        // Verify verifiers are registered
        assertTrue(verifierPool.isRegisteredVerifier(user2));
        assertTrue(verifierPool.isRegisteredVerifier(user3));
        assertTrue(verifierPool.isRegisteredVerifier(user4));
        
        console.log("✅ Verifiers registered and bonded");
    }
    
    function _submitWorkClaim(uint256 actionId) internal returns (uint256) {
        vm.prank(user1);
        
        uint256 claimId = claims.submitClaim(
            actionId,
            "ipfs://QmE2ETestEvidenceCodeReviewCompleted",
            "Completed comprehensive code review of ShiftGovernor contract with security analysis"
        );
        
        // Verify claim was submitted
        Claims.Claim memory claim = claims.getClaim(claimId);
        assertEq(claim.claimant, user1);
        assertEq(claim.actionId, actionId);
        assert(claim.status == Claims.ClaimStatus.PENDING_VERIFICATION);
        
        console.log("Submitted claim ID:", claimId);
        return claimId;
    }
    
    function _verifyClaim(uint256 claimId) internal {
        // Verifiers review and vote on the claim
        // Need 2 out of 3 to approve (jurorsMin = 2)
        
        vm.prank(user2);
        claims.verifyClaimAsVerifier(claimId, true, "Code review is thorough and meets standards");
        
        vm.prank(user3);
        claims.verifyClaimAsVerifier(claimId, true, "Security analysis is comprehensive");
        
        vm.prank(user4);
        claims.verifyClaimAsVerifier(claimId, false, "Missing performance impact analysis");
        
        // Wait for verification window if needed
        vm.warp(block.timestamp + 1 hours);
        
        // Finalize verification (should be approved with 2/3 votes)
        claims.finalizeVerification(claimId);
        
        // Verify claim was approved
        Claims.Claim memory claim = claims.getClaim(claimId);
        assert(claim.status == Claims.ClaimStatus.APPROVED);
        
        console.log("✅ Claim verified and approved");
    }
    
    function _distributeRewards(uint256 claimId) internal {
        // Check initial balances
        uint256 initialMembershipBalance = membershipToken.balanceOf(user1);
        uint256 initialWorkerSBTs = workerSBT.balanceOf(user1);
        
        console.log("Initial membership tokens:", initialMembershipBalance);
        console.log("Initial worker SBTs:", initialWorkerSBTs);
        
        // Claim should have automatically triggered reward distribution
        Claims.Claim memory claim = claims.getClaim(claimId);
        ValuableActionRegistry.ValuableAction memory action = valuableActionRegistry.getAction(claim.actionId);
        
        // Check final balances
        uint256 finalMembershipBalance = membershipToken.balanceOf(user1);
        uint256 finalWorkerSBTs = workerSBT.balanceOf(user1);
        
        console.log("Final membership tokens:", finalMembershipBalance);
        console.log("Final worker SBTs:", finalWorkerSBTs);
        
        // Verify rewards were distributed
        assertEq(
            finalMembershipBalance,
            initialMembershipBalance + action.membershipTokenReward,
            "Membership tokens should be rewarded"
        );
        
        assertEq(
            finalWorkerSBTs,
            initialWorkerSBTs + 1,
            "Should receive 1 worker SBT"
        );
        
        console.log("✅ Rewards distributed successfully");
    }
    
    // =================================================================
    // INTEGRATION TESTS
    // =================================================================
    
    /**
     * @dev Test integration between governance and work verification systems
     */
    function testIntegration_GovernanceCreatesActionThenWorkVerification() public {
        console.log("=== TESTING GOVERNANCE → WORK VERIFICATION INTEGRATION ===");
        
        // Part 1: Use governance to create a new valuable action type
        uint256 requestId = _createActionCreationRequest();
        uint256 draftId = _createActionCreationDraft(requestId);
        uint256 proposalId = _escalateActionCreationProposal(draftId);
        _voteAndExecuteActionCreation(proposalId);
        
        // Part 2: Use the newly created action for work verification
        uint256 newActionId = 2; // Assuming this is the second action created
        _setupVerifiers();
        uint256 claimId = _submitWorkClaim(newActionId);
        _verifyClaim(claimId);
        _distributeRewards(claimId);
        
        console.log("✅ Integration test completed successfully");
    }
    
    function _createActionCreationRequest() internal returns (uint256) {
        vm.prank(user1);
        
        string[] memory tags = new string[](2);
        tags[0] = "action-type";
        tags[1] = "documentation";
        
        return requestHub.createRequest(
            COMMUNITY_ID,
            "Create Documentation Review Action Type",
            "ipfs://QmE2ETestRequestDocumentationAction",
            tags
        );
    }
    
    function _createActionCreationDraft(uint256 requestId) internal returns (uint256) {
        vm.prank(user2);
        
        // Create calldata for new action creation
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = VALUABLE_ACTION_REGISTRY;
        values[0] = 0;
        
        calldatas[0] = abi.encodeWithSelector(
            ValuableActionRegistry.createAction.selector,
            COMMUNITY_ID,
            "Documentation Review",
            "ipfs://QmE2ETestActionDocumentation",
            25,    // membershipTokenReward
            50,    // communityTokenReward  
            0,     // investorSBTReward
            1,     // jurorsMin
            2,     // panelSize
            5 days, // verifyWindow
            12 hours, // cooldownPeriod
            2,     // maxConcurrent
            5,     // verifierRewardWeight
            300,   // slashVerifierBps
            true,  // revocable
            0x02,  // evidenceTypes
            "Documentation quality checklist and review notes"
        );
        
        DraftsManager.ActionBundle memory actionBundle = DraftsManager.ActionBundle({
            targets: targets,
            values: values,
            calldatas: calldatas
        });
        
        return draftsManager.createDraft(
            requestId,
            actionBundle,
            "ipfs://QmE2ETestDraftDocumentationAction"
        );
    }
    
    function _escalateActionCreationProposal(uint256 draftId) internal returns (uint256) {
        vm.prank(user2);
        draftsManager.finalizeForProposal(draftId);
        
        vm.prank(user2);
        return draftsManager.escalateToProposal(
            draftId,
            false,
            0,
            "Proposal: Create Documentation Review Action Type for Community Contributors"
        );
    }
    
    function _voteAndExecuteActionCreation(uint256 proposalId) internal {
        // Wait and vote (majority approval)
        vm.roll(block.number + governor.votingDelay() + 1);
        
        vm.prank(user1);
        governor.castVote(proposalId, 1);
        vm.prank(user2);
        governor.castVote(proposalId, 1);
        vm.prank(user3);
        governor.castVote(proposalId, 1);
        vm.prank(user4);
        governor.castVote(proposalId, 1);
        
        vm.roll(block.number + governor.votingPeriod() + 1);
        
        // Queue and execute
        DraftsManager.Draft memory draft = draftsManager.getDraft(2); // Second draft
        bytes32 descriptionHash = keccak256(
            bytes("Proposal: Create Documentation Review Action Type for Community Contributors")
        );
        
        vm.prank(user1);
        governor.queue(draft.actions.targets, draft.actions.values, draft.actions.calldatas, descriptionHash);
        
        vm.warp(block.timestamp + 2 days + 1);
        
        vm.prank(user1);
        governor.execute(draft.actions.targets, draft.actions.values, draft.actions.calldatas, descriptionHash);
        
        console.log("✅ New action type created via governance");
    }
    
    // =================================================================
    // UTILITY FUNCTIONS
    // =================================================================
    
    function testContractConnections() public view {
        console.log("=== VERIFYING CONTRACT CONNECTIONS ===");
        
        // Test contract connections and basic reads
        console.log("Community Registry Address:", address(communityRegistry));
        console.log("Request Hub Address:", address(requestHub));
        console.log("Governor Address:", address(governor));
        console.log("Membership Token Address:", address(membershipToken));
        
        // Read community info
        CommunityRegistry.Community memory community = communityRegistry.communities(COMMUNITY_ID);
        console.log("Community Name:", community.name);
        console.log("Community Active:", community.active);
        
        console.log("✅ All contract connections verified");
    }
    
    function testTokenBalances() public view {
        console.log("=== CHECKING TOKEN BALANCES ===");
        
        console.log("Deployer balance:", membershipToken.balanceOf(DEPLOYER));
        console.log("User1 balance:", membershipToken.balanceOf(user1));
        console.log("User2 balance:", membershipToken.balanceOf(user2));
        
        console.log("Total supply:", membershipToken.totalSupply());
        
        console.log("✅ Token balances checked");
    }
}