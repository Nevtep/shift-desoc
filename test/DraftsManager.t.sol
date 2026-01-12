// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {DraftsManager} from "contracts/modules/DraftsManager.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {ICommunityRegistry} from "contracts/modules/interfaces/ICommunityRegistry.sol";
import {IRequestHub} from "contracts/modules/interfaces/IRequestHub.sol";

contract MockCommunityRegistry {
    mapping(uint256 => bool) public communities;
    mapping(uint256 => ICommunityRegistry.ModuleAddresses) internal modulesByCommunity;

    function addCommunity(uint256 communityId, address requestHub) external {
        communities[communityId] = true;
        modulesByCommunity[communityId].requestHub = requestHub;
    }

    function setRequestHub(uint256 communityId, address requestHub) external {
        modulesByCommunity[communityId].requestHub = requestHub;
    }

    function setCommunityModules(uint256 communityId, ICommunityRegistry.ModuleAddresses calldata modules) external {
        modulesByCommunity[communityId] = modules;
    }

    function getCommunityModules(uint256 communityId) external view returns (ICommunityRegistry.ModuleAddresses memory) {
        if (!communities[communityId]) {
            revert Errors.InvalidInput("Community does not exist");
        }
        return modulesByCommunity[communityId];
    }
}

contract MockRequestHub is IRequestHub {
    mapping(uint256 => Request) internal requests;

    function addRequest(uint256 requestId, uint256 communityId, address author) external {
        Request storage request = requests[requestId];
        request.communityId = communityId;
        request.author = author;
    }

    function getRequest(uint256 requestId) external view override returns (Request memory request) {
        request = requests[requestId];
        if (request.author == address(0)) {
            revert Errors.InvalidInput("Request does not exist");
        }
    }
}

contract MockGovernor {
    uint256 private _nextProposalId = 1;
    mapping(uint256 => bool) public proposalExists;
    mapping(uint256 => bool) public isMultiChoice;
    mapping(uint256 => uint8) public numOptions;
    
    function propose(
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        string memory
    ) external returns (uint256 proposalId) {
        proposalId = _nextProposalId++;
        proposalExists[proposalId] = true;
        return proposalId;
    }
    
    function proposeMultiChoice(
        address[] memory,
        uint256[] memory,
        bytes[] memory,
        string memory,
        uint8 _numOptions
    ) external returns (uint256 proposalId) {
        proposalId = _nextProposalId++;
        proposalExists[proposalId] = true;
        isMultiChoice[proposalId] = true;
        numOptions[proposalId] = _numOptions;
        return proposalId;
    }
}

contract DraftsManagerTest is Test {
    DraftsManager public draftsManager;
    MockCommunityRegistry public communityRegistry;
    MockGovernor public governor;
    MockRequestHub public requestHub;
    
    // Test addresses
    address public user1 = address(0x101);
    address public user2 = address(0x102);
    address public user3 = address(0x103);
    address public user4 = address(0x104);
    address public timelock = address(0x501);
    address public reviewer1 = address(0x201);
    address public reviewer2 = address(0x202);
    address public reviewer3 = address(0x203);
    
    // Test data
    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant REQUEST_ID = 100;
    string public constant VERSION_CID = "QmTestVersion1";
    string public constant REVIEW_CID = "QmTestReview1";
    string public constant PROPOSAL_DESC = "Test proposal description";
    
    DraftsManager.ActionBundle public testActions;
    
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
    
    event ContributorRemoved(
        uint256 indexed draftId,
        address indexed contributor,
        address indexed removedBy
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
    
    event ReviewRetracted(
        uint256 indexed draftId,
        address indexed reviewer
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
    
    event ProposalOutcomeUpdated(
        uint256 indexed draftId,
        uint256 indexed proposalId,
        DraftsManager.DraftStatus outcome
    );

    event GovernorUpdated(address indexed oldGovernor, address indexed newGovernor);

    event ConfigurationUpdated(uint256 reviewPeriod, uint256 minReviewsForEscalation, uint256 supportThresholdBps);
    
    function setUp() public {
        // Deploy mock contracts
        communityRegistry = new MockCommunityRegistry();
        requestHub = new MockRequestHub();
        governor = new MockGovernor();
        
        // Deploy DraftsManager
        draftsManager = new DraftsManager(address(communityRegistry), address(governor), timelock);
        
        // Setup test community
        _addCommunity(COMMUNITY_ID);
        _addRequest(REQUEST_ID, COMMUNITY_ID, user1);
        
        // Setup test actions
        address[] memory targets = new address[](2);
        uint256[] memory values = new uint256[](2);
        bytes[] memory calldatas = new bytes[](2);
        
        targets[0] = address(0x1000);
        targets[1] = address(0x2000);
        values[0] = 100 ether;
        values[1] = 200 ether;
        calldatas[0] = abi.encodeWithSignature("testFunction1()");
        calldatas[1] = abi.encodeWithSignature("testFunction2(uint256)", 42);
        
        testActions = DraftsManager.ActionBundle({
            targets: targets,
            values: values,
            calldatas: calldatas,
            actionsHash: keccak256(abi.encode(targets, values, calldatas))
        });
        
        // Fund test accounts
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
        vm.deal(user4, 100 ether);
        vm.deal(reviewer1, 100 ether);
        vm.deal(reviewer2, 100 ether);
        vm.deal(reviewer3, 100 ether);
    }

    function _addCommunity(uint256 communityId) internal {
        ICommunityRegistry.ModuleAddresses memory modules;
        modules.requestHub = address(requestHub);
        modules.timelock = timelock;
        communityRegistry.addCommunity(communityId, address(requestHub));
        communityRegistry.setCommunityModules(communityId, modules);
    }

    function _addRequest(uint256 requestId, uint256 communityId, address author) internal {
        requestHub.addRequest(requestId, communityId, author);
    }
    
    /* ======== CONSTRUCTOR TESTS ======== */
    
    function testConstructor() public view {
        assertEq(draftsManager.communityRegistry(), address(communityRegistry));
        assertEq(draftsManager.governor(), address(governor));
        assertEq(draftsManager.getDraftsCount(), 0);
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new DraftsManager(address(0), address(governor), timelock);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new DraftsManager(address(communityRegistry), address(0), timelock);

        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        new DraftsManager(address(communityRegistry), address(governor), address(0));
    }
    
    /* ======== DRAFT CREATION TESTS ======== */
    
    function testCreateDraft() public {
        vm.expectEmit(true, true, true, true);
        emit DraftCreated(0, COMMUNITY_ID, REQUEST_ID, user1, testActions.actionsHash, VERSION_CID);
        
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        assertEq(draftId, 0);
        assertEq(draftsManager.getDraftsCount(), 1);
        
        // Check draft details
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
        assertEq(actions.targets.length, 2);
        assertEq(actions.targets[0], testActions.targets[0]);
        assertEq(actions.values[0], testActions.values[0]);
        assertEq(versionCIDs.length, 1);
        assertEq(versionCIDs[0], VERSION_CID);
        assertTrue(status == DraftsManager.DraftStatus.DRAFTING);
        assertEq(createdAt, block.timestamp);
        assertEq(reviewStartedAt, 0);
        assertEq(finalizedAt, 0);
        assertEq(proposalId, 0);
        
        // Check mappings
        uint256[] memory communityDrafts = draftsManager.getDraftsByCommunity(COMMUNITY_ID);
        assertEq(communityDrafts.length, 1);
        assertEq(communityDrafts[0], draftId);
        
        uint256[] memory requestDrafts = draftsManager.getDraftsByRequest(REQUEST_ID);
        assertEq(requestDrafts.length, 1);
        assertEq(requestDrafts[0], draftId);
        
        uint256[] memory authorDrafts = draftsManager.getDraftsByAuthor(user1);
        assertEq(authorDrafts.length, 1);
        assertEq(authorDrafts[0], draftId);
    }

    function testCreateDraftRecomputesActionsHash() public {
        DraftsManager.ActionBundle memory tampered = testActions;
        tampered.actionsHash = bytes32(uint256(123));

        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, tampered, VERSION_CID);

        (,,,, DraftsManager.ActionBundle memory actions,,,,,,) = draftsManager.getDraft(draftId);
        assertEq(actions.actionsHash, testActions.actionsHash);
    }

    function testCreateDraftMismatchedActionsReverts() public {
        address[] memory targets = new address[](2);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](2);

        DraftsManager.ActionBundle memory badActions = DraftsManager.ActionBundle({
            targets: targets,
            values: values,
            calldatas: calldatas,
            actionsHash: bytes32(0)
        });

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Actions length mismatch"));
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, badActions, VERSION_CID);
    }
    
    function testCreateDraftWithoutRequest() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, 0, testActions, VERSION_CID);
        
        (,uint256 requestId,,,,,,,,,) = draftsManager.getDraft(draftId);
        assertEq(requestId, 0);
        
        // Should not be in request mappings
        uint256[] memory requestDrafts = draftsManager.getDraftsByRequest(0);
        assertEq(requestDrafts.length, 0);
    }

    function testCreateDraftRevertsForMissingCommunity() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community does not exist"));
        vm.prank(user1);
        draftsManager.createDraft(COMMUNITY_ID + 1, REQUEST_ID, testActions, VERSION_CID);
    }

    function testCreateDraftRevertsWhenRequestHubNotConfigured() public {
        uint256 communityWithoutHub = COMMUNITY_ID + 2;
        communityRegistry.addCommunity(communityWithoutHub, address(0));

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "RequestHub not set"));
        vm.prank(user1);
        draftsManager.createDraft(communityWithoutHub, REQUEST_ID, testActions, VERSION_CID);
    }

    function testCreateDraftRevertsForMissingRequest() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        vm.prank(user1);
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID + 50, testActions, VERSION_CID);
    }
    
    function testCreateDraftEmptyVersionCIDReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Version CID cannot be empty"));
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "");
    }
    
    function testCreateMultipleDrafts() public {
        // Create first draft
        vm.prank(user1);
        uint256 draft1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, "version1");
        
        // Create second draft
        requestHub.addRequest(REQUEST_ID + 1, COMMUNITY_ID, user2);
        vm.prank(user2);
        uint256 draft2 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID + 1, testActions, "version2");
        
        assertEq(draft1, 0);
        assertEq(draft2, 1);
        assertEq(draftsManager.getDraftsCount(), 2);
        
        // Check community drafts
        uint256[] memory communityDrafts = draftsManager.getDraftsByCommunity(COMMUNITY_ID);
        assertEq(communityDrafts.length, 2);
        assertEq(communityDrafts[0], draft1);
        assertEq(communityDrafts[1], draft2);
    }
    
    /* ======== CONTRIBUTOR MANAGEMENT TESTS ======== */
    
    function testAddContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.expectEmit(true, true, true, true);
        emit ContributorAdded(draftId, user2, user1);
        
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // Check contributor was added
        assertTrue(draftsManager.isContributor(draftId, user2));
        
        (,,, address[] memory contributors,,,,,,,) = draftsManager.getDraft(draftId);
        assertEq(contributors.length, 1);
        assertEq(contributors[0], user2);
        
        // Check contributor mappings
        uint256[] memory contributorDrafts = draftsManager.getDraftsByContributor(user2);
        assertEq(contributorDrafts.length, 1);
        assertEq(contributorDrafts[0], draftId);
    }
    
    function testAddContributorByContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Add user2 as contributor
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // user2 can now add user3
        vm.prank(user2);
        draftsManager.addContributor(draftId, user3);
        
        assertTrue(draftsManager.isContributor(draftId, user3));
    }
    
    function testAddContributorUnauthorizedReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.NotAuthorized.selector, user2));
        draftsManager.addContributor(draftId, user3);
    }
    
    function testAddContributorZeroAddressReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        draftsManager.addContributor(draftId, address(0));
    }
    
    function testAddContributorAlreadyExistsReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Add user2
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // Try to add user2 again
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.ContributorAlreadyExists.selector, user2));
        draftsManager.addContributor(draftId, user2);
        
        // Try to add author as contributor
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.ContributorAlreadyExists.selector, user1));
        draftsManager.addContributor(draftId, user1);
    }
    
    function testAddContributorWrongStatusReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Submit for review
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Cannot add contributors during review
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(
            DraftsManager.InvalidStatus.selector,
            DraftsManager.DraftStatus.REVIEW,
            DraftsManager.DraftStatus.DRAFTING
        ));
        draftsManager.addContributor(draftId, user2);
    }
    
    function testRemoveContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Add contributors
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        vm.prank(user1);
        draftsManager.addContributor(draftId, user3);
        
        vm.expectEmit(true, true, true, true);
        emit ContributorRemoved(draftId, user2, user1);
        
        // Remove user2
        vm.prank(user1);
        draftsManager.removeContributor(draftId, user2);
        
        // Check user2 is no longer a contributor
        assertFalse(draftsManager.isContributor(draftId, user2));
        assertTrue(draftsManager.isContributor(draftId, user3));
        
        (,,, address[] memory contributors,,,,,,,) = draftsManager.getDraft(draftId);
        assertEq(contributors.length, 1);
        assertEq(contributors[0], user3);
    }
    
    function testRemoveContributorNotFoundReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.ContributorNotFound.selector, user2));
        draftsManager.removeContributor(draftId, user2);
    }
    
    /* ======== VERSION MANAGEMENT TESTS ======== */
    
    function testSnapshotVersion() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        string memory newVersionCID = "QmNewVersion";
        
        vm.expectEmit(true, true, true, true);
        emit VersionSnapshot(draftId, 1, newVersionCID, user1);
        
        vm.prank(user1);
        draftsManager.snapshotVersion(draftId, newVersionCID);
        
        (,,,,, string[] memory versionCIDs,,,,,) = draftsManager.getDraft(draftId);
        assertEq(versionCIDs.length, 2);
        assertEq(versionCIDs[0], VERSION_CID);
        assertEq(versionCIDs[1], newVersionCID);
    }
    
    function testSnapshotVersionByContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Add contributor
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // Contributor can snapshot
        vm.prank(user2);
        draftsManager.snapshotVersion(draftId, "QmContributorVersion");
        
        (,,,,, string[] memory versionCIDs,,,,,) = draftsManager.getDraft(draftId);
        assertEq(versionCIDs.length, 2);
    }
    
    function testSnapshotVersionEmptyCIDReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Version CID cannot be empty"));
        draftsManager.snapshotVersion(draftId, "");
    }
    
    function testSnapshotVersionUnauthorizedReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.NotAuthorized.selector, user2));
        draftsManager.snapshotVersion(draftId, "QmUnauthorized");
    }
    
    /* ======== REVIEW PROCESS TESTS ======== */
    
    function testSubmitForReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.expectEmit(true, true, true, true);
        emit DraftStatusChanged(draftId, DraftsManager.DraftStatus.DRAFTING, DraftsManager.DraftStatus.REVIEW, user1);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        (,,,,,, DraftsManager.DraftStatus status, , uint64 reviewStartedAt,,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.REVIEW);
        assertEq(reviewStartedAt, block.timestamp);
    }
    
    function testSubmitReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.expectEmit(true, true, true, true);
        emit ReviewSubmitted(draftId, reviewer1, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        // Check review summary
        (uint256 support, uint256 oppose, uint256 neutral, uint256 requestChanges, uint256 total) = 
            draftsManager.getReviewSummary(draftId);
        
        assertEq(support, 1);
        assertEq(oppose, 0);
        assertEq(neutral, 0);
        assertEq(requestChanges, 0);
        assertEq(total, 1);
        
        // Check specific review
        (DraftsManager.ReviewType reviewType, string memory reasonCID, uint64 timestamp, bool isActive) = 
            draftsManager.getReview(draftId, reviewer1);
            
        assertTrue(reviewType == DraftsManager.ReviewType.SUPPORT);
        assertEq(reasonCID, REVIEW_CID);
        assertEq(timestamp, block.timestamp);
        assertTrue(isActive);
    }
    
    function testSubmitMultipleReviews() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Submit different types of reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, REVIEW_CID);
        
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.REQUEST_CHANGES, REVIEW_CID);
        
        (uint256 support, uint256 oppose, uint256 neutral, uint256 requestChanges, uint256 total) = 
            draftsManager.getReviewSummary(draftId);
        
        assertEq(support, 1);
        assertEq(oppose, 1);
        assertEq(neutral, 0);
        assertEq(requestChanges, 1);
        assertEq(total, 3);
    }
    
    function testSubmitReviewContributorReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Add contributor
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Author cannot review
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Contributors cannot review their own draft"));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        // Contributor cannot review
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Contributors cannot review their own draft"));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
    }
    
    function testSubmitReviewAlreadyReviewedReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        // Try to review again
        vm.prank(reviewer1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.AlreadyReviewed.selector, reviewer1));
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, REVIEW_CID);
    }
    
    function testRetractReview() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.expectEmit(true, true, false, false);
        emit ReviewRetracted(draftId, reviewer1);
        
        vm.prank(reviewer1);
        draftsManager.retractReview(draftId);
        
        // Check review is no longer active
        (,, uint64 timestamp, bool isActive) = draftsManager.getReview(draftId, reviewer1);
        assertFalse(isActive);
        assertGt(timestamp, 0);
        
        // Check counters updated
        (uint256 support,,,, uint256 total) = draftsManager.getReviewSummary(draftId);
        assertEq(support, 0);
        assertEq(total, 0);
    }
    
    /* ======== FINALIZATION TESTS ======== */
    
    function testFinalizeForProposal() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Submit required reviews with sufficient support
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        // Advance time past review period
        vm.warp(block.timestamp + 3 days + 1);
        
        vm.expectEmit(true, true, true, true);
        emit DraftStatusChanged(draftId, DraftsManager.DraftStatus.REVIEW, DraftsManager.DraftStatus.FINALIZED, user1);
        
        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);
        
        (,,,,,, DraftsManager.DraftStatus status,,, uint64 finalizedAt,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.FINALIZED);
        assertEq(finalizedAt, block.timestamp);
    }
    
    function testFinalizeForProposalReviewPeriodNotMetReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Submit sufficient reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        // Try to finalize before review period
        uint256 timeRemaining = 3 days - (block.timestamp - block.timestamp);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.ReviewPeriodNotMet.selector, timeRemaining));
        draftsManager.finalizeForProposal(draftId);
    }
    
    function testFinalizeForProposalInsufficientReviewsReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Submit only one review (need 3)
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.warp(block.timestamp + 3 days + 1);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.InsufficientReviews.selector, 1, 3));
        draftsManager.finalizeForProposal(draftId);
    }
    
    function testFinalizeForProposalInsufficientSupportReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // Submit 3 reviews but only 1 support (33% < 60% required)
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, REVIEW_CID);
        
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.OPPOSE, REVIEW_CID);
        
        vm.warp(block.timestamp + 3 days + 1);
        
        // 1/3 = 3333 bps, need 6000 bps (60%)
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.InsufficientSupport.selector, 3333, 6000));
        draftsManager.finalizeForProposal(draftId);
    }
    
    /* ======== ESCALATION TESTS ======== */
    
    function testEscalateToProposal() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Complete review process
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.warp(block.timestamp + 3 days + 1);
        
        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);
        
        vm.expectEmit(true, true, true, true);
        emit ProposalEscalated(draftId, 1, false, 0);
        
        vm.prank(user1);
        uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);
        
        assertEq(proposalId, 1);
        
        (,,,,,, DraftsManager.DraftStatus status,,,, uint256 storedProposalId) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.ESCALATED);
        assertEq(storedProposalId, proposalId);
    }
    
    function testEscalateToProposalMultiChoice() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Complete review process
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.warp(block.timestamp + 3 days + 1);
        
        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);
        
        vm.expectEmit(true, true, true, true);
        emit ProposalEscalated(draftId, 1, true, 3);
        
        vm.prank(user1);
        uint256 proposalId = draftsManager.escalateToProposal(draftId, true, 3, PROPOSAL_DESC);
        
        assertEq(proposalId, 1);
        assertTrue(governor.isMultiChoice(proposalId));
        assertEq(governor.numOptions(proposalId), 3);
    }
    
    function testEscalateToProposalInvalidOptionsReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Complete review process quickly
        _completeReviewProcess(draftId);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Multi-choice requires at least 2 options"));
        draftsManager.escalateToProposal(draftId, true, 1, PROPOSAL_DESC);
    }
    
    /* ======== OUTCOME UPDATE TESTS ======== */
    
    function testUpdateProposalOutcome() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        _completeReviewProcess(draftId);
        
        vm.prank(user1);
        uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);
        
        vm.expectEmit(true, true, true, true);
        emit ProposalOutcomeUpdated(draftId, proposalId, DraftsManager.DraftStatus.WON);
        
        // TODO: This should be called by governance, but we don't have authorization checks yet
        vm.prank(timelock);
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);
        
        (,,,,,, DraftsManager.DraftStatus status,,,,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.WON);
    }
    
    function testUpdateProposalOutcomeInvalidOutcomeReverts() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        _completeReviewProcess(draftId);
        
        vm.prank(user1);
        draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Outcome must be WON or LOST"));
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.DRAFTING);
    }

    function testUpdateProposalOutcomeAuthorizedByAuthor() public {
        uint256 draftId = _escalateDraft();

        vm.prank(user1);
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);

        (,,,,,, DraftsManager.DraftStatus status,,,,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.WON);
    }

    function testUpdateProposalOutcomeAuthorizedByContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);

        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);

        _completeReviewProcess(draftId);

        vm.prank(user1);
        draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);

        vm.prank(user2);
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.LOST);

        (,,,,,, DraftsManager.DraftStatus status,,,,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.LOST);
    }

    function testUpdateProposalOutcomeAuthorizedByTimelock() public {
        uint256 draftId = _escalateDraft();

        vm.prank(timelock);
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.LOST);

        (,,,,,, DraftsManager.DraftStatus status,,,,) = draftsManager.getDraft(draftId);
        assertTrue(status == DraftsManager.DraftStatus.LOST);
    }

    function testUpdateProposalOutcomeUnauthorizedReverts() public {
        uint256 draftId = _escalateDraft();

        vm.prank(user4);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.NotAuthorized.selector, user4));
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);
    }

    /* ======== ADMIN TESTS ======== */

    function testUpdateGovernorAuthorized() public {
        vm.prank(timelock);
        vm.expectEmit(true, true, false, true);
        emit GovernorUpdated(address(governor), user3);
        draftsManager.updateGovernor(user3);

        assertEq(draftsManager.governor(), user3);
    }

    function testUpdateGovernorUnauthorizedReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.NotAuthorized.selector, user1));
        draftsManager.updateGovernor(user2);
    }

    function testUpdateGovernorZeroAddressReverts() public {
        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(Errors.ZeroAddress.selector));
        draftsManager.updateGovernor(address(0));
    }

    function testUpdateConfigurationAuthorized() public {
        vm.prank(timelock);
        vm.expectEmit(false, false, false, true);
        emit ConfigurationUpdated(1 days, 5, 7000);
        draftsManager.updateConfiguration(1 days, 5, 7000);

        assertEq(draftsManager.reviewPeriod(), 1 days);
        assertEq(draftsManager.minReviewsForEscalation(), 5);
        assertEq(draftsManager.supportThresholdBps(), 7000);
    }

    function testUpdateConfigurationUnauthorizedReverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.NotAuthorized.selector, user1));
        draftsManager.updateConfiguration(1 days, 5, 7000);
    }

    function testUpdateConfigurationSupportThresholdTooHighReverts() public {
        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Support threshold cannot exceed 100%"));
        draftsManager.updateConfiguration(1 days, 5, 10001);
    }
    
    /* ======== VIEW FUNCTIONS TESTS ======== */
    
    function testGetDraftNonexistentReverts() public {
        vm.expectRevert(abi.encodeWithSelector(DraftsManager.DraftNotFound.selector, 999));
        draftsManager.getDraft(999);
    }
    
    function testIsContributor() public {
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // Author is a contributor
        assertTrue(draftsManager.isContributor(draftId, user1));
        
        // Non-contributor is not
        assertFalse(draftsManager.isContributor(draftId, user2));
        
        // Add user2 as contributor
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // Now user2 is a contributor
        assertTrue(draftsManager.isContributor(draftId, user2));
    }
    
    function testGetDraftsByMappings() public {
        // Create drafts for different scenarios
        vm.prank(user1);
        uint256 draft1 = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        _addRequest(REQUEST_ID + 1, COMMUNITY_ID, user1);
        vm.prank(user1);
        draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID + 1, testActions, VERSION_CID);
        
        _addCommunity(COMMUNITY_ID + 1);
        vm.prank(user2);
        uint256 draft3 = draftsManager.createDraft(COMMUNITY_ID + 1, REQUEST_ID, testActions, VERSION_CID);
        
        // Add user2 as contributor to draft1
        vm.prank(user1);
        draftsManager.addContributor(draft1, user2);
        
        // Test community mappings
        uint256[] memory community1Drafts = draftsManager.getDraftsByCommunity(COMMUNITY_ID);
        assertEq(community1Drafts.length, 2);
        
        uint256[] memory community2Drafts = draftsManager.getDraftsByCommunity(COMMUNITY_ID + 1);
        assertEq(community2Drafts.length, 1);
        assertEq(community2Drafts[0], draft3);
        
        // Test request mappings
        uint256[] memory request1Drafts = draftsManager.getDraftsByRequest(REQUEST_ID);
        assertEq(request1Drafts.length, 2);
        
        // Test author mappings
        uint256[] memory user1Drafts = draftsManager.getDraftsByAuthor(user1);
        assertEq(user1Drafts.length, 2);
        
        uint256[] memory user2Drafts = draftsManager.getDraftsByAuthor(user2);
        assertEq(user2Drafts.length, 1);
        assertEq(user2Drafts[0], draft3);
        
        // Test contributor mappings
        uint256[] memory user2ContribDrafts = draftsManager.getDraftsByContributor(user2);
        assertEq(user2ContribDrafts.length, 1);
        assertEq(user2ContribDrafts[0], draft1);
    }
    
    /* ======== INTEGRATION TESTS ======== */
    
    function testEndToEndDraftWorkflow() public {
        // 1. Create draft
        vm.prank(user1);
        uint256 draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);
        
        // 2. Add contributors
        vm.prank(user1);
        draftsManager.addContributor(draftId, user2);
        
        // 3. Create versions
        vm.prank(user1);
        draftsManager.snapshotVersion(draftId, "QmVersion2");
        
        vm.prank(user2);
        draftsManager.snapshotVersion(draftId, "QmVersion3");
        
        // 4. Submit for review
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        // 5. Get reviews
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReview1");
        
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReview2");
        
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, "QmReview3");
        
        // 6. Wait review period
        vm.warp(block.timestamp + 3 days + 1);
        
        // 7. Finalize
        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);
        
        // 8. Escalate to proposal
        vm.prank(user2); // Contributor can escalate
        uint256 proposalId = draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);
        
        // 9. Update outcome
        vm.prank(timelock);
        draftsManager.updateProposalOutcome(draftId, DraftsManager.DraftStatus.WON);
        
        // Verify final state
        (,,,,,, DraftsManager.DraftStatus finalStatus,,,, uint256 storedProposalId) = draftsManager.getDraft(draftId);
        assertTrue(finalStatus == DraftsManager.DraftStatus.WON);
        assertEq(storedProposalId, proposalId);
        
        (uint256 support,,,, uint256 total) = draftsManager.getReviewSummary(draftId);
        assertEq(support, 3);
        assertEq(total, 3);
    }
    
    /* ======== HELPER FUNCTIONS ======== */
    
    function _completeReviewProcess(uint256 draftId) internal {
        vm.prank(user1);
        draftsManager.submitForReview(draftId);
        
        vm.prank(reviewer1);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer2);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        vm.prank(reviewer3);
        draftsManager.submitReview(draftId, DraftsManager.ReviewType.SUPPORT, REVIEW_CID);
        
        vm.warp(block.timestamp + 3 days + 1);
        
        vm.prank(user1);
        draftsManager.finalizeForProposal(draftId);
    }

    function _escalateDraft() internal returns (uint256 draftId) {
        vm.prank(user1);
        draftId = draftsManager.createDraft(COMMUNITY_ID, REQUEST_ID, testActions, VERSION_CID);

        _completeReviewProcess(draftId);

        vm.prank(user1);
        draftsManager.escalateToProposal(draftId, false, 0, PROPOSAL_DESC);
    }
}