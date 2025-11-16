// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "contracts/modules/RequestHub.sol";
import "contracts/modules/CommunityRegistry.sol";
import "contracts/libs/Errors.sol";

contract RequestHubTest is Test {
    RequestHub requestHub;
    CommunityRegistry communityRegistry;
    
    // Test accounts
    address admin = makeAddr("admin");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address moderator = makeAddr("moderator");
    
    // Test data
    uint256 communityId;
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
        communityRegistry = new CommunityRegistry(admin);
        requestHub = new RequestHub(address(communityRegistry));
        
        // Create test community
        communityId = communityRegistry.registerCommunity(
            "Test Community",
            "A test community",
            "ipfs://test",
            0 // no parent community
        );
        
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
        assertEq(request.bountyAmount, 0);
        assertEq(request.linkedValuableAction, 0);
        
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
        
        vm.expectEmit(true, false, false, true);
        emit RequestHub.BountyAdded(requestId, 1000, user2);
        
        requestHub.addBounty(requestId, 1000);
        
        RequestHub.Request memory request = requestHub.getRequest(requestId);
        assertEq(request.bountyAmount, 1000);
        
        vm.stopPrank();
    }
    
    function testAddBountyZeroAmount() public {
        vm.prank(user1);
        uint256 requestId = requestHub.createRequest(communityId, TITLE, CID, tags);
        
        vm.startPrank(user2);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Bounty amount must be positive"));
        requestHub.addBounty(requestId, 0);
        
        vm.stopPrank();
    }
    
    function testAddBountyNonexistentRequest() public {
        vm.startPrank(user1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Request does not exist"));
        requestHub.addBounty(999, 1000);
        
        vm.stopPrank();
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