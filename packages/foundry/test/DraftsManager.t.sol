// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {DraftsManager} from "contracts/modules/DraftsManager.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {CountingMultiChoice} from "contracts/core/CountingMultiChoice.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract DraftsManagerTest is Test {
    DraftsManager public draftsManager;
    CommunityRegistry public communityRegistry;
    ShiftGovernor public governor;
    MembershipTokenERC20Votes public token;
    TimelockController public timelock;
    CountingMultiChoice public multiChoice;

    address public admin = makeAddr("admin");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public reviewer1 = makeAddr("reviewer1");
    address public reviewer2 = makeAddr("reviewer2");
    address public reviewer3 = makeAddr("reviewer3");

    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant REQUEST_ID = 1;

    // Test action bundle
    DraftsManager.ActionBundle testActions;

    event DraftCreated(
        uint256 indexed draftId,
        uint256 indexed communityId,
        uint256 indexed requestId,
        address author,
        bytes32 actionsHash,
        string versionCID
    );

    event ContributorAdded(
        uint256 indexed draftId,
        address indexed contributor,
        address indexed addedBy
    );

    event VersionSnapshot(
        uint256 indexed draftId,
        uint256 versionNumber,
        string versionCID,
        address indexed contributor
    );

    event ReviewSubmitted(
        uint256 indexed draftId,
        address indexed reviewer,
        DraftsManager.ReviewType reviewType,
        string reasonCID
    );

    event DraftStatusChanged(
        uint256 indexed draftId,
        DraftsManager.DraftStatus oldStatus,
        DraftsManager.DraftStatus newStatus,
        address indexed changedBy
    );

    event ProposalEscalated(
        uint256 indexed draftId,
        uint256 indexed proposalId,
        bool isMultiChoice,
        uint8 numOptions
    );

    function setUp() public {
        vm.startPrank(admin);

        // Deploy token
        token = new MembershipTokenERC20Votes("Test Token", "TEST");

        // Deploy timelock with 1 hour delay
        address[] memory proposers = new address[](1);
        address[] memory executors = new address[](1);
        proposers[0] = address(0); // Will set governor later
        executors[0] = address(0); // Anyone can execute
        timelock = new TimelockController(3600, proposers, executors, admin);

        // Deploy community registry
        communityRegistry = new CommunityRegistry(admin);

        // Deploy governor
        governor = new ShiftGovernor(address(token), address(timelock));
        
        // Deploy multi-choice counter
        multiChoice = new CountingMultiChoice();
        governor.initCountingMulti(address(multiChoice));

        // Deploy drafts manager
        draftsManager = new DraftsManager(address(communityRegistry), address(governor));

        // Setup governance roles
        timelock.grantRole(timelock.PROPOSER_ROLE(), address(governor));
        timelock.grantRole(timelock.EXECUTOR_ROLE(), address(0));

        // Register test community
        communityRegistry.registerCommunity("Test Community", "A test community", "ipfs://test", 0);

        // Setup test actions
        testActions.targets = new address[](1);
        testActions.values = new uint256[](1);
        testActions.calldatas = new bytes[](1);
        testActions.targets[0] = address(token);
        testActions.values[0] = 0;
        testActions.calldatas[0] = abi.encodeWithSignature("pause()");
        testActions.actionsHash = keccak256(abi.encode(testActions.targets, testActions.values, testActions.calldatas));

        // Distribute tokens for voting (admin got all tokens in constructor)
        token.transfer(user1, 10e18);
        token.transfer(user2, 5e18);
        token.transfer(reviewer1, 2e18);
        token.transfer(reviewer2, 2e18);
        token.transfer(reviewer3, 2e18);

        vm.stopPrank();
    }

    /* ======== CREATION TESTS ======== */

    function testCreateDraft() public {
        vm.startPrank(user1);

        vm.expectEmit(true, true, true, true);
        emit DraftCreated(0, COMMUNITY_ID, REQUEST_ID, user1, testActions.actionsHash, "QmTestCID");

        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        // Verify draft details
        (
            uint256 communityId,
            uint256 requestId,
            address author,
            address[] memory contributors,
            DraftsManager.ActionBundle memory actions,
            string[] memory versionCIDs,
            DraftsManager.DraftStatus status,
            uint64 createdAt,
            uint64 reviewStartedAt,
            uint64 finalizedAt,
            uint256 proposalId
        ) = draftsManager.getDraft(draftId);

        assertEq(communityId, COMMUNITY_ID);
        assertEq(requestId, REQUEST_ID);
        assertEq(author, user1);
        assertEq(contributors.length, 0);
        assertEq(actions.targets.length, 1);
        assertEq(actions.targets[0], testActions.targets[0]);
        assertEq(versionCIDs.length, 1);
        assertEq(versionCIDs[0], "QmTestCID");
        assertTrue(status == DraftsManager.DraftStatus.DRAFTING);
        assertEq(createdAt, block.timestamp);
        assertEq(reviewStartedAt, 0);
        assertEq(finalizedAt, 0);
        assertEq(proposalId, 0);

        vm.stopPrank();
    }

    function testCreateDraftEmptyCID() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("InvalidInput(string)", "Version CID cannot be empty"));
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "");
        
        vm.stopPrank();
    }

    function testCreateDraftWithoutRequest() public {
        vm.startPrank(user1);

        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, 0, testActions, "QmTestCID");

        (
            uint256 communityId,
            uint256 requestId,
            ,,,,,,,,
        ) = draftsManager.getDraft(draftId);

        assertEq(communityId, COMMUNITY_ID);
        assertEq(requestId, 0);

        vm.stopPrank();
    }

    /* ======== CONTRIBUTOR MANAGEMENT TESTS ======== */

    function testAddContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, false);
        emit ContributorAdded(draftId, user2, user1);
        
        draftsManager.addContributor(draftId, user2);

        // Verify contributor was added
        assertTrue(draftsManager.isContributor(draftId, user2));
        
        (, , , address[] memory contributors, , , , , , , ) = draftsManager.getDraft(draftId);
        assertEq(contributors.length, 1);
        assertEq(contributors[0], user2);

        vm.stopPrank();
    }

    function testAddContributorUnauthorized() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSignature("NotAuthorized(address)", user2));
        draftsManager.addContributor(draftId, user3);
        
        vm.stopPrank();
    }

    function testAddContributorZeroAddress() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        draftsManager.addContributor(draftId, address(0));
        
        vm.stopPrank();
    }

    function testAddContributorAlreadyExists() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        draftsManager.addContributor(draftId, user2);
        
        vm.expectRevert(abi.encodeWithSignature("ContributorAlreadyExists(address)", user2));
        draftsManager.addContributor(draftId, user2);
        
        vm.stopPrank();
    }

    function testAddContributorAuthorAsContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("ContributorAlreadyExists(address)", user1));
        draftsManager.addContributor(draftId, user1);
        
        vm.stopPrank();
    }

    function testRemoveContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        // Add contributor
        draftsManager.addContributor(draftId, user2);
        assertTrue(draftsManager.isContributor(draftId, user2));
        
        // Remove contributor
        draftsManager.removeContributor(draftId, user2);
        assertFalse(draftsManager.isContributor(draftId, user2));
        
        (, , , address[] memory contributors, , , , , , , ) = draftsManager.getDraft(draftId);
        assertEq(contributors.length, 0);
        
        vm.stopPrank();
    }

    function testRemoveContributorNotFound() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("ContributorNotFound(address)", user2));
        draftsManager.removeContributor(draftId, user2);
        
        vm.stopPrank();
    }

    function testContributorCanModifyDraft() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        // Add contributor
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);

        // Contributor can add version
        vm.prank(user2);
        draftsManager.snapshotVersion(draftId, "QmNewVersion");

        // Contributor can add other contributors
        vm.prank(user2);
        draftsManager.addContributor(draftId, user3);
    }

    /* ======== VERSIONING TESTS ======== */

    function testSnapshotVersion() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, true);
        emit VersionSnapshot(draftId, 1, "QmNewVersion", user1);
        
        draftsManager.snapshotVersion(draftId, "QmNewVersion");

        // Verify new version was added
        (, , , , , string[] memory versionCIDs, , , , , ) = draftsManager.getDraft(draftId);
        assertEq(versionCIDs.length, 2);
        assertEq(versionCIDs[0], "QmTestCID");
        assertEq(versionCIDs[1], "QmNewVersion");
        
        vm.stopPrank();
    }

    function testSnapshotVersionEmptyCID() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("InvalidInput(string)", "Version CID cannot be empty"));
        draftsManager.snapshotVersion(draftId, "");
        
        vm.stopPrank();
    }

    function testSnapshotVersionUnauthorized() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSignature("NotAuthorized(address)", user2));
        draftsManager.snapshotVersion(draftId, "QmNewVersion");
        
        vm.stopPrank();
    }

    /* ======== REVIEW WORKFLOW TESTS ======== */

    function testSubmitForReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, true);
        emit DraftStatusChanged(draftId, DraftsManager.DraftStatus.DRAFTING, DraftsManager.DraftStatus.REVIEW, user1);
        
        draftsManager.submitForReview(draftId);

        // Verify status changed
        (, , , , , , DraftsManager.DraftStatus status, , uint64 reviewStartedAt, , ) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.REVIEW);
        assertEq(reviewStartedAt, block.timestamp);
        
        vm.stopPrank();
    }

    function testSubmitReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        vm.startPrank(reviewer1);
        
        vm.expectEmit(true, true, true, true);
        emit ReviewSubmitted(draftId, reviewer1, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");
        
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");

        // Verify review was recorded
        (
            DraftsManager.ReviewType reviewType,
            string memory reasonCID,
            uint64 timestamp,
            bool isActive
        ) = draftsManager.getReview(draftId, reviewer1);
        
        assertTrue(reviewType == DraftsManager.ReviewType.SUPPORT);
        assertEq(reasonCID, "QmReviewCID");
        assertEq(timestamp, block.timestamp);
        assertTrue(isActive);

        // Verify review counts
        (
            uint256 supportCount,
            uint256 opposeCount,
            uint256 neutralCount,
            uint256 requestChangesCount,
            uint256 totalReviews
        ) = draftsManager.getReviewSummary(draftId);
        
        assertEq(supportCount, 1);
        assertEq(opposeCount, 0);
        assertEq(neutralCount, 0);
        assertEq(requestChangesCount, 0);
        assertEq(totalReviews, 1);
        
        vm.stopPrank();
    }

    function testSubmitReviewContributorsCannot() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Author cannot review
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidInput(string)", "Contributors cannot review their own draft"));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");
        vm.stopPrank();

        // Contributor cannot review
        vm.startPrank(user2);
        vm.expectRevert(abi.encodeWithSignature("InvalidInput(string)", "Contributors cannot review their own draft"));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");
        vm.stopPrank();
    }

    function testSubmitReviewAlreadyReviewed() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        vm.startPrank(reviewer1);
        
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");
        
        vm.expectRevert(abi.encodeWithSignature("AlreadyReviewed(address)", reviewer1));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, "QmReviewCID2");
        
        vm.stopPrank();
    }

    function testRetractReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReviewCID");

        vm.startPrank(reviewer1);
        
        draftsManager.retractReview(draftId);

        // Verify review was retracted
        (
            ,
            ,
            ,
            bool isActive
        ) = draftsManager.getReview(draftId, reviewer1);
        
        assertFalse(isActive);

        // Verify counts updated
        (
            uint256 supportCount,
            ,
            ,
            ,
            uint256 totalReviews
        ) = draftsManager.getReviewSummary(draftId);
        
        assertEq(supportCount, 0);
        assertEq(totalReviews, 0);
        
        vm.stopPrank();
    }

    function testMultipleReviews() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Multiple reviewers submit different types of reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, "QmOppose");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.REQUEST_CHANGES, "QmChanges");

        // Verify all counts
        (
            uint256 supportCount,
            uint256 opposeCount,
            uint256 neutralCount,
            uint256 requestChangesCount,
            uint256 totalReviews
        ) = draftsManager.getReviewSummary(draftId);
        
        assertEq(supportCount, 1);
        assertEq(opposeCount, 1);
        assertEq(neutralCount, 0);
        assertEq(requestChangesCount, 1);
        assertEq(totalReviews, 3);
    }

    /* ======== FINALIZATION TESTS ======== */

    function testFinalizeForProposal() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add enough positive reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        // Fast forward past review period
        vm.warp(block.timestamp + 3 days + 1);

        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, true);
        emit DraftStatusChanged(draftId, DraftsManager.DraftStatus.REVIEW, DraftsManager.DraftStatus.FINALIZED, user1);
        
        draftsManager.finalizeForProposal(draftId);

        // Verify status changed
        (, , , , , , DraftsManager.DraftStatus status, , , uint64 finalizedAt, ) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.FINALIZED);
        assertEq(finalizedAt, block.timestamp);
        
        vm.stopPrank();
    }

    function testFinalizeForProposalReviewPeriodNotMet() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add enough positive reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("ReviewPeriodNotMet(uint256)", 3 days));
        draftsManager.finalizeForProposal(draftId);
        
        vm.stopPrank();
    }

    function testFinalizeForProposalInsufficientReviews() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add only one review (need 3)
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.warp(block.timestamp + 3 days + 1);

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("InsufficientReviews(uint256,uint256)", 1, 3));
        draftsManager.finalizeForProposal(draftId);
        
        vm.stopPrank();
    }

    function testFinalizeForProposalInsufficientSupport() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add mixed reviews (only 33% support, need 60%)
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, "QmOppose1");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, "QmOppose2");

        vm.warp(block.timestamp + 3 days + 1);

        vm.startPrank(user1);
        
        // 1/3 = 3333 basis points, need 6000
        vm.expectRevert(abi.encodeWithSignature("InsufficientSupport(uint256,uint256)", 3333, 6000));
        draftsManager.finalizeForProposal(draftId);
        
        vm.stopPrank();
    }

    /* ======== ESCALATION TESTS ======== */

    function testEscalateToProposalBinary() public {
        // Setup finalized draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add supporting reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);

        vm.startPrank(user1);
        
        uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, "Test Proposal");

        // Verify escalation
        (, , , , , , DraftsManager.DraftStatus status, , , , uint256 storedProposalId) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.ESCALATED);
        assertEq(storedProposalId, proposalId);
        assertTrue(proposalId > 0); // Should be a valid proposal ID
        
        vm.stopPrank();
    }

    function testEscalateToProposalMultiChoice() public {
        // Setup finalized draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add supporting reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);

        vm.startPrank(user1);
        
        uint256 proposalId = draftsManager.escalateToProposal(draftId, true, 3, "Multi-Choice Test Proposal");

        // Verify escalation
        (, , , , , , DraftsManager.DraftStatus status, , , , uint256 storedProposalId) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.ESCALATED);
        assertEq(storedProposalId, proposalId);
        assertTrue(proposalId > 0); // Should be a valid proposal ID
        
        vm.stopPrank();
    }

    function testEscalateToProposalMultiChoiceInvalidOptions() public {
        // Setup finalized draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Add supporting reviews and finalize
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);

        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSignature("InvalidInput(string)", "Multi-choice requires at least 2 options"));
        draftsManager.escalateToProposal(draftId, true, 1, "Invalid Multi-Choice");
        
        vm.stopPrank();
    }

    /* ======== STATUS UPDATE TESTS ======== */

    function testUpdateProposalOutcome() public {
        // Setup escalated draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        // Go through full workflow
        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);

        vm.prank(user1);
        draftsManager.escalateToProposal(draftId, false, 0, "Test Proposal");

        // Update outcome to WON
        vm.startPrank(admin); // TODO: Should be governance
        
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);

        // Verify status updated
        (, , , , , , DraftsManager.DraftStatus status, , , , ) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.WON);
        
        vm.stopPrank();
    }

    /* ======== VIEW FUNCTION TESTS ======== */

    function testGetDraftsCount() public {
        assertEq(draftsManager.getDraftsCount(), 0);

        vm.prank(user1);
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        assertEq(draftsManager.getDraftsCount(), 1);
    }

    function testGetDraftsByCommunity() public {
        vm.prank(user1);
        uint256 draftId1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user2);
        uint256 draftId2 = draftsManager.createDraft(COMMUNITY_ID, 0, testActions, "QmTestCID2");

        uint256[] memory communityDrafts = draftsManager.getDraftsByCommunity(COMMUNITY_ID);
        assertEq(communityDrafts.length, 2);
        assertEq(communityDrafts[0], draftId1);
        assertEq(communityDrafts[1], draftId2);
    }

    function testGetDraftsByRequest() public {
        vm.prank(user1);
        uint256 draftId1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user2);
        uint256 draftId2 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID2");

        uint256[] memory requestDrafts = draftsManager.getDraftsByRequest(REQUEST_ID);
        assertEq(requestDrafts.length, 2);
        assertEq(requestDrafts[0], draftId1);
        assertEq(requestDrafts[1], draftId2);
    }

    function testGetDraftsByAuthor() public {
        vm.startPrank(user1);
        
        uint256 draftId1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");
        uint256 draftId2 = draftsManager.createDraft(COMMUNITY_ID, 0, testActions, "QmTestCID2");

        uint256[] memory authorDrafts = draftsManager.getDraftsByAuthor(user1);
        assertEq(authorDrafts.length, 2);
        assertEq(authorDrafts[0], draftId1);
        assertEq(authorDrafts[1], draftId2);
        
        vm.stopPrank();
    }

    function testGetDraftsByContributor() public {
        vm.prank(user1);
        uint256 draftId1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        vm.prank(user2);
        uint256 draftId2 = draftsManager.createDraft(COMMUNITY_ID, 0, testActions, "QmTestCID2");

        // Add user3 as contributor to both drafts
        vm.prank(user1);
        draftsManager.addContributor(draftId1, user3);

        vm.prank(user2);
        draftsManager.addContributor(draftId2, user3);

        uint256[] memory contributorDrafts = draftsManager.getDraftsByContributor(user3);
        assertEq(contributorDrafts.length, 2);
        assertEq(contributorDrafts[0], draftId1);
        assertEq(contributorDrafts[1], draftId2);
    }

    /* ======== ERROR CONDITION TESTS ======== */

    function testNonexistentDraft() public {
        vm.expectRevert(abi.encodeWithSignature("DraftNotFound(uint256)", 999));
        draftsManager.getDraft(999);
    }

    function testOperationsOnWrongStatus() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmTestCID");

        // Submit for review
        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // Try to add contributor (should fail - not in DRAFTING)
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidStatus(uint8,uint8)", uint8(DraftsManager.DraftStatus.REVIEW), uint8(DraftsManager.DraftStatus.DRAFTING)));
        draftsManager.addContributor(draftId, user2);
        vm.stopPrank();
    }

    /* ======== INTEGRATION TESTS ======== */

    function testFullWorkflow() public {
        // 1. Create draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "QmInitialVersion");

        // 2. Add contributors and versions
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);

        vm.prank(user2);
        draftsManager.snapshotVersion(draftId, "QmVersion2");

        vm.prank(user1);
        draftsManager.snapshotVersion(draftId, "QmFinalVersion");

        // 3. Submit for review
        vm.prank(user1);
        draftsManager.submitForReview(draftId);

        // 4. Multiple reviewers submit reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport1");

        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport2");

        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmSupport3");

        // 5. Wait for review period and finalize
        vm.warp(block.timestamp + 3 days + 1);

        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);

        // 6. Escalate to governance
        vm.prank(user1);
        uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, "Final Proposal");

        // 7. Update outcome
        vm.prank(admin); // TODO: Should be governance
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);

        // Verify final state
        (, , , , , string[] memory versionCIDs, DraftsManager.DraftStatus status, , , , uint256 storedProposalId) = draftsManager.getDraft(draftId);
        
        assertEq(versionCIDs.length, 3);
        assertEq(versionCIDs[0], "QmInitialVersion");
        assertEq(versionCIDs[1], "QmVersion2");
        assertEq(versionCIDs[2], "QmFinalVersion");
        assertTrue(status == DraftsManager.DraftStatus.WON);
        assertEq(storedProposalId, proposalId);
    }
}