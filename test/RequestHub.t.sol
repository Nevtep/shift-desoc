// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "contracts/modules/RequestHub.sol";
import "contracts/modules/CommunityRegistry.sol";
import "contracts/modules/ParamController.sol";
import "contracts/libs/Errors.sol";
import "contracts/libs/Types.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract ValuableActionRegistryMock {
    mapping(uint256 => Types.ValuableAction) public actions;
    mapping(uint256 => bool) public active;
    uint256 public nextTokenId = 1;

    function setAction(uint256 id, Types.ValuableAction memory action, bool isActive_) external {
        actions[id] = action;
        active[id] = isActive_;
    }

    function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory action) {
        return actions[id];
    }

    function isValuableActionActive(uint256 id) external view returns (bool) {
        return active[id];
    }

    function issueEngagement(
        uint256,
        address,
        Types.EngagementSubtype,
        bytes32,
        bytes calldata
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
    }
}

contract RequestHubTest is Test {
    RequestHub requestHub;
    CommunityRegistry communityRegistry;
    ValuableActionRegistryMock valuableActionRegistry;
    MockERC20 token;
    
    // Test accounts
    address admin = makeAddr("admin");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address moderator = makeAddr("moderator");
    address treasuryVault = makeAddr("vault");
    
    // Test data
    uint256 communityId;
    uint256 constant ACTION_ID = 1;
    string constant TITLE = "Test Request";
    string constant CID = "QmTestContentHash";
    string[] tags = ["development", "urgent"];
    string constant COMMENT_CID = "QmCommentHash";
    
    event RequestCreated(
        uint256 indexed requestId,
        uint256 indexed communityId, 
        address indexed author,
        string title,
        string cid,
        string[] tags
    );
    
    event CommentPosted(
        uint256 indexed requestId,
        uint256 indexed commentId,
        address indexed author,
        string cid,
        uint256 parentCommentId
    );
    
    event RequestStatusChanged(
        uint256 indexed requestId,
        RequestHub.Status indexed newStatus,
        address indexed moderator
    );
    
    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy contracts
        ParamController paramController = new ParamController(admin);
        communityRegistry = new CommunityRegistry(admin, address(paramController));
        valuableActionRegistry = new ValuableActionRegistryMock();
        token = new MockERC20();

        requestHub = new RequestHub(address(communityRegistry), address(valuableActionRegistry));
        
        // Create test community
        communityId = communityRegistry.registerCommunity(
            "Test Community",
            "A test community",
            "ipfs://test",
            0 // no parent community
        );

        communityRegistry.setModuleAddress(communityId, keccak256("treasuryVault"), treasuryVault);

        // Configure a default valuable action for completion tests
        Types.ValuableAction memory action = Types.ValuableAction({
            membershipTokenReward: 1,
            communityTokenReward: 0,
            investorSBTReward: 0,
            category: Types.ActionCategory.ENGAGEMENT_ONE_SHOT,
            roleTypeId: bytes32(0),
            positionPoints: 0,
            verifierPolicy: Types.VerifierPolicy.NONE,
            metadataSchemaId: bytes32(0),
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: 1,
            verifierRewardWeight: 0,
            slashVerifierBps: 0,
            cooldownPeriod: 1,
            maxConcurrent: 1,
            revocable: false,
            evidenceTypes: 0,
            proposalThreshold: 0,
            proposer: admin,
            evidenceSpecCID: "",
            titleTemplate: "",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 0
        });
        valuableActionRegistry.setAction(ACTION_ID, action, true);
        
        // Grant moderator role
        communityRegistry.grantCommunityRole(communityId, moderator, communityRegistry.MODERATOR_ROLE());
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           REQUEST CREATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testCreateRequest() public {
        vm.startPrank(user1);
        
        // Should emit RequestCreated event
        vm.expectEmit(true, true, true, true);
        emit RequestCreated(1, communityId, user1, TITLE, CID, tags);
        
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        assertEq(requestId, 1);
        
        // Verify request data
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.communityId, communityId);
        assertEq(request.author, user1);
        assertEq(request.title, TITLE);
        assertEq(request.cid, CID);
        assertEq(uint8(request.status), uint8(RequestHub.Status.OPEN_DEBATE));
        assertEq(request.createdAt, block.timestamp);
        assertEq(request.lastActivity, block.timestamp);
        assertEq(request.tags.length, 2);
        assertEq(request.tags[0], "development");
        assertEq(request.tags[1], "urgent");
        assertEq(request.commentCount, 0);
        assertEq(request.bountyToken, address(0));
        assertEq(request.bountyAmount, 0);
        assertEq(request.linkedValuableAction, 0);
        assertEq(request.consumed, false);
        assertEq(request.winner, address(0));
        
        vm.stopPrank();
    }
    
    function testCreateRequestInvalidCommunity() public {
        vm.startPrank(user1);
        
        vm.expectRevert();
        requestHub.createRequest(999, TITLE, CID, tags);
        
        vm.stopPrank();
    }
    
    function testCreateRequestEmptyTitle() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Title cannot be empty"));
        requestHub.createRequest(communityId, "", CID, tags);
        
        vm.stopPrank();
    }
    
    function testCreateRequestEmptyCid() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Content CID cannot be empty"));
        requestHub.createRequest(communityId, TITLE, "", tags);
        
        vm.stopPrank();
    }
    
    function testCreateMultipleRequests() public {
        vm.startPrank(user1);
        
        uint256 requestId1 = requestHub.createRequest(communityId, "Request 1", "cid1", tags);
        
        // Wait 1 minute to avoid rate limiting
        vm.warp(block.timestamp + 61);
        
        uint256 requestId2 = requestHub.createRequest(communityId, "Request 2", "cid2", tags);
        
        assertEq(requestId1, 1);
        assertEq(requestId2, 2);
        
        uint256[] memory communityRequests = requestHub.getCommunityRequests(communityId);
        assertEq(communityRequests.length, 2);
        assertEq(communityRequests[0], 1);
        assertEq(communityRequests[1], 2);
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           COMMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testPostComment() public {
        // Create request first
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        vm.warp(block.timestamp + 61); // Avoid rate limiting
        
        // Should emit CommentPosted event
        vm.expectEmit(true, true, true, true);
        emit CommentPosted(requestId, 1, user2, COMMENT_CID, 0);
        
        uint256 commentId = requestHub.postComment(requestId, 0, COMMENT_CID);
        
        assertEq(commentId, 1);
        
        // Verify comment data
        RequestHub.Comment memory comment = requestHub.getComment(commentId);
        assertEq(comment.requestId, requestId);
        assertEq(comment.author, user2);
        assertEq(comment.cid, COMMENT_CID);
        assertEq(comment.parentCommentId, 0);
        assertEq(comment.createdAt, block.timestamp);
        assertEq(comment.isModerated, false);
        
        // Verify request was updated
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.commentCount, 1);
        assertEq(request.lastActivity, block.timestamp);
        
        uint256[] memory comments = requestHub.getRequestComments(requestId);
        assertEq(comments.length, 1);
        assertEq(comments[0], 1);
        
        vm.stopPrank();
    }
    
    function testPostReplyComment() public {
        // Create request and parent comment
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.prank(user2);
        vm.warp(block.timestamp + 61);
        uint256 parentCommentId = requestHub.postComment(requestId, 0, "parent comment");
        
        // Post reply
        vm.startPrank(user1);
        vm.warp(block.timestamp + 61);
        
        uint256 replyId = requestHub.postComment(requestId, parentCommentId, "reply comment");
        
        RequestHub.Comment memory reply = requestHub.getComment(replyId);
        assertEq(reply.parentCommentId, parentCommentId);
        
        vm.stopPrank();
    }
    
    function testPostCommentNonexistentRequest() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        requestHub.postComment(999, 0, COMMENT_CID);
        
        vm.stopPrank();
    }
    
    function testPostCommentInvalidParent() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        vm.warp(block.timestamp + 61);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Parent comment not in this request"));
        requestHub.postComment(requestId, 999, COMMENT_CID);
        
        vm.stopPrank();
    }
    
    function testPostCommentEmptyCid() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        vm.warp(block.timestamp + 61);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Content CID cannot be empty"));
        requestHub.postComment(requestId, 0, "");
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           MODERATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetRequestStatus() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(moderator);
        
        // Should emit RequestStatusChanged event
        vm.expectEmit(true, true, true, true);
        emit RequestStatusChanged(requestId, RequestHub.Status.FROZEN, moderator);
        
        requestHub.setRequestStatus(requestId, RequestHub.Status.FROZEN);
        
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(uint8(request.status), uint8(RequestHub.Status.FROZEN));
        
        vm.stopPrank();
    }
    
    function testSetRequestStatusUnauthorized() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user2));
        requestHub.setRequestStatus(requestId, RequestHub.Status.FROZEN);
        
        vm.stopPrank();
    }
    
    function testSetRequestStatusNonexistentRequest() public {
        vm.startPrank(moderator);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        requestHub.setRequestStatus(999, RequestHub.Status.FROZEN);
        
        vm.stopPrank();
    }
    
    function testPostCommentOnFrozenRequest() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        // Freeze the request
        vm.prank(moderator);
        requestHub.setRequestStatus(requestId, RequestHub.Status.FROZEN);
        
        vm.startPrank(user2);
        vm.warp(block.timestamp + 61);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request is not open for comments"));
        requestHub.postComment(requestId, 0, COMMENT_CID);
        
        vm.stopPrank();
    }
    
    function testModerateComment() public {
        // Create request and comment
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.prank(user2);
        vm.warp(block.timestamp + 61);
        uint256 commentId = requestHub.postComment(requestId, 0, COMMENT_CID);
        
        // Moderate comment
        vm.prank(moderator);
        requestHub.moderateComment(commentId, true);
        
        RequestHub.Comment memory comment = requestHub.getComment(commentId);
        assertEq(comment.isModerated, true);
        
        // Unmoderate
        vm.prank(moderator);
        requestHub.moderateComment(commentId, false);
        
        comment = requestHub.getComment(commentId);
        assertEq(comment.isModerated, false);
    }
    
    function testModerateCommentUnauthorized() public {
        // Create request and comment
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.prank(user2);
        vm.warp(block.timestamp + 61);
        uint256 commentId = requestHub.postComment(requestId, 0, COMMENT_CID);
        
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user1));
        requestHub.moderateComment(commentId, true);
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           BOUNTY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testAddBounty() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        token.mint(user2, 1_000 ether);
        token.approve(address(requestHub), type(uint256).max);
        
        vm.expectEmit(true, true, false, true);
        emit RequestHub.BountyAdded(requestId, communityId, address(token), 1_000, user2);
        
        requestHub.addBounty(requestId, address(token), 1_000);
        
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.bountyAmount, 1_000);
        assertEq(request.bountyToken, address(token));
        assertEq(token.balanceOf(treasuryVault), 1_000);
        assertEq(token.balanceOf(address(requestHub)), 0);
        
        vm.stopPrank();
    }
    
    function testAddBountyZeroAmount() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Bounty amount must be positive"));
        requestHub.addBounty(requestId, address(0xBEEF), 0);
        
        vm.stopPrank();
    }
    
    function testAddBountyNonexistentRequest() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        requestHub.addBounty(999, address(0xBEEF), 1000);
        
        vm.stopPrank();
    }

    function testAddBountyAfterWinnerApprovedReverts() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);

        vm.startPrank(user1);
        token.mint(user1, 2_000 ether);
        token.approve(address(requestHub), type(uint256).max);
        requestHub.addBounty(requestId, address(token), 1_000);
        vm.stopPrank();

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Winner already approved"));
        requestHub.addBounty(requestId, address(token), 500);
    }

    function testAddBountyTopUpTransfersDelta() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);

        vm.startPrank(user1);
        token.mint(user1, 2_000 ether);
        token.approve(address(requestHub), type(uint256).max);
        requestHub.addBounty(requestId, address(token), 1_000);
        requestHub.addBounty(requestId, address(token), 1_600);
        vm.stopPrank();

        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.bountyAmount, 1_600);
        assertEq(token.balanceOf(treasuryVault), 1_600);
        assertEq(token.balanceOf(address(requestHub)), 0);
    }

    /*//////////////////////////////////////////////////////////////
                       WINNER & COMPLETION TESTS
    //////////////////////////////////////////////////////////////*/

    function _createLinkedRequest() internal returns (uint256 requestId) {
        vm.prank(user1);
        requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        vm.prank(user1);
        requestHub.linkValuableAction(requestId, ACTION_ID);
    }

    function testSetApprovedWinnerAuthorized() public {
        uint256 requestId = _createLinkedRequest();

        vm.prank(moderator);
        vm.expectEmit(true, true, true, false);
        emit RequestHub.ApprovedWinnerSet(requestId, user2, moderator);
        requestHub.setApprovedWinner(requestId, user2);

        assertEq(requestHub.approvedWinner(requestId), user2);
    }

    function testSetApprovedWinnerUnauthorized() public {
        uint256 requestId = _createLinkedRequest();

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user2));
        requestHub.setApprovedWinner(requestId, user2);
    }

    function testSetApprovedWinnerCannotClearOrReset() public {
        uint256 requestId = _createLinkedRequest();

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Winner already approved"));
        requestHub.setApprovedWinner(requestId, user1);
    }

    function testCompleteEngagementHappyPath() public {
        uint256 requestId = _createLinkedRequest();

        vm.startPrank(user1);
        token.mint(user1, 1_000 ether);
        token.approve(address(requestHub), type(uint256).max);
        requestHub.addBounty(requestId, address(token), 500);
        vm.stopPrank();

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.startPrank(user2);
        vm.expectEmit(true, true, true, true);
        emit RequestHub.BountyReady(requestId, communityId, user2, address(token), 500);
        vm.expectEmit(true, true, false, true);
        emit RequestHub.OneShotEngagementCompleted(requestId, user2, address(token), 500, 1);
        uint256 tokenId = requestHub.completeEngagement(requestId, bytes("evidence"));
        vm.stopPrank();

        assertEq(tokenId, 1);
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertTrue(request.consumed);
        assertEq(request.winner, user2);
        assertEq(token.balanceOf(treasuryVault), 500);
        assertEq(token.balanceOf(address(requestHub)), 0);
    }

    function testCompleteEngagementRequiresApproval() public {
        uint256 requestId = _createLinkedRequest();

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Winner not approved"));
        requestHub.completeEngagement(requestId, bytes("evidence"));
    }

    function testCompleteEngagementWrongCaller() public {
        uint256 requestId = _createLinkedRequest();

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user1));
        requestHub.completeEngagement(requestId, bytes("evidence"));
    }

    function testCompleteEngagementCannotRepeat() public {
        uint256 requestId = _createLinkedRequest();
        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);
        vm.prank(user2);
        requestHub.completeEngagement(requestId, bytes("evidence"));

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request already consumed"));
        requestHub.completeEngagement(requestId, bytes("evidence"));
    }

    function testCompleteEngagementRequiresOneShotCategory() public {
        uint256 requestId = _createLinkedRequest();

        Types.ValuableAction memory action = valuableActionRegistry.getValuableAction(ACTION_ID);
        action.category = Types.ActionCategory.CREDENTIAL;
        valuableActionRegistry.setAction(ACTION_ID, action, true);

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Not a one-shot action"));
        requestHub.completeEngagement(requestId, bytes("evidence"));
    }

    function testCompleteEngagementRequiresActiveAction() public {
        uint256 requestId = _createLinkedRequest();

        Types.ValuableAction memory action = valuableActionRegistry.getValuableAction(ACTION_ID);
        valuableActionRegistry.setAction(ACTION_ID, action, false);

        vm.prank(moderator);
        requestHub.setApprovedWinner(requestId, user2);

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidValuableAction.selector, ACTION_ID));
        requestHub.completeEngagement(requestId, bytes("evidence"));
    }
    
    /*//////////////////////////////////////////////////////////////
                        ACTION TYPE LINKING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testLinkValuableActionAsAuthor() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, true, false);
        emit RequestHub.ValuableActionLinking(requestId, 123, user1);
        
        requestHub.linkValuableAction(requestId, 123);
        
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.linkedValuableAction, 123);
        
        vm.stopPrank();
    }
    
    function testLinkValuableActionAsCommunityAdmin() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        // Admin can link ValuableAction even if not author
        vm.startPrank(admin);
        
        requestHub.linkValuableAction(requestId, 456);
        
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.linkedValuableAction, 456);
        
        vm.stopPrank();
    }
    
    function testLinkValuableActionUnauthorized() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user2));
        requestHub.linkValuableAction(requestId, 123);
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           RATE LIMITING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRateLimitingMinimumTime() public {
        vm.startPrank(user1);
        
        requestHub.createRequest(communityId, TITLE, CID, tags);
        
        // Try to post immediately - should fail
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Post too soon after previous post"));
        requestHub.createRequest(communityId, "Second Request", CID, tags);
        
        // Wait 1 minute - should succeed
        vm.warp(block.timestamp + 61);
        requestHub.createRequest(communityId, "Second Request", CID, tags);
        
        vm.stopPrank();
    }
    
    function testRateLimitingComments() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        vm.warp(block.timestamp + 61);
        
        requestHub.postComment(requestId, 0, "Comment 1");
        
        // Try to comment immediately - should fail
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Post too soon after previous post"));
        requestHub.postComment(requestId, 0, "Comment 2");
        
        // Wait 1 minute - should succeed
        vm.warp(123); // 62 + 61 = 123
        requestHub.postComment(requestId, 0, "Comment 2");
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetRequestsByTag() public {
        vm.startPrank(user1);
        
        // Create requests with different tags
        string[] memory tags1 = new string[](1);
        tags1[0] = "development";
        uint256 req1 = requestHub.createRequest(communityId, "Dev Request 1", "cid1", tags1);
        
        vm.warp(block.timestamp + 61);
        string[] memory tags2 = new string[](2);
        tags2[0] = "development";
        tags2[1] = "urgent";
        uint256 req2 = requestHub.createRequest(communityId, "Dev Request 2", "cid2", tags2);
        
        vm.warp(block.timestamp + 61);
        string[] memory tags3 = new string[](1);
        tags3[0] = "marketing";
        requestHub.createRequest(communityId, "Marketing Request", "cid3", tags3);
        
        // Search by tag
        uint256[] memory devRequests = requestHub.getRequestsByTag(communityId, "development");
        assertEq(devRequests.length, 2);
        assertEq(devRequests[0], req1);
        assertEq(devRequests[1], req2);
        
        uint256[] memory urgentRequests = requestHub.getRequestsByTag(communityId, "urgent");
        assertEq(urgentRequests.length, 1);
        assertEq(urgentRequests[0], req2);
        
        uint256[] memory marketingRequests = requestHub.getRequestsByTag(communityId, "marketing");
        assertEq(marketingRequests.length, 1);
        
        uint256[] memory nonexistentRequests = requestHub.getRequestsByTag(communityId, "nonexistent");
        assertEq(nonexistentRequests.length, 0);
        
        vm.stopPrank();
    }
    
    function testGetNonexistentRequest() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        requestHub.getRequest(999);
    }
    
    function testGetNonexistentComment() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Comment does not exist"));
        requestHub.getComment(999);
    }
}