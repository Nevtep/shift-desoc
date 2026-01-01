// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "../libs/Errors.sol";
import {Types} from "../libs/Types.sol";
import {CommunityRegistry} from "./CommunityRegistry.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IValuableActionRegistry {
    function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory action);
    function isValuableActionActive(uint256 id) external view returns (bool);
    function issueEngagement(
        uint256 communityId,
        address to,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external returns (uint256 tokenId);
}

/// @title RequestHub
/// @notice Decentralized discussion forum for community needs and collaborative solution development
/// @dev On-chain discussion entry point where community members post needs/ideas and collaborate on solutions
contract RequestHub is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    /*//////////////////////////////////////////////////////////////
                                ENUMS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Status of a request
    enum Status { 
        OPEN_DEBATE,  // Active discussion
        FROZEN,       // Locked by moderators, no new posts
        ARCHIVED      // Permanently archived
    }
    
    /*//////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Request metadata and content
    struct Request {
        uint256 communityId;      // Community this request belongs to
        address author;           // Request creator
        string title;             // Request title
        string cid;               // IPFS content hash
        Status status;            // Current status
        uint64 createdAt;         // Creation timestamp
        uint64 lastActivity;      // Last comment timestamp
        string[] tags;            // Categorization tags
        uint256 commentCount;     // Number of comments
        address bountyToken;      // Token used for bounty payouts
        uint256 bountyAmount;     // Optional bounty amount (0 if none)
        uint256 linkedValuableAction; // Linked ValuableAction ID (0 if none)
        bool consumed;            // Whether engagement has been completed
        address winner;           // Finalized winner/recipient
    }
    
    /// @notice Comment on a request
    struct Comment {
        uint256 requestId;        // Parent request
        address author;           // Comment author
        string cid;               // IPFS content hash
        uint256 parentCommentId;  // Parent comment (0 for top-level)
        uint64 createdAt;         // Creation timestamp
        bool isModerated;         // Hidden by moderators
    }
    
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Community registry for access control and community data
    CommunityRegistry public immutable communityRegistry;

    /// @notice ValuableActionRegistry for engagement issuance and policy lookup
    IValuableActionRegistry public immutable valuableActionRegistry;
    
    /// @notice Next request ID
    uint256 public nextRequestId = 1;
    
    /// @notice Next comment ID  
    uint256 public nextCommentId = 1;
    
    /// @notice All requests by ID
    mapping(uint256 => Request) public requests;
    
    /// @notice All comments by ID
    mapping(uint256 => Comment) public comments;
    
    /// @notice Requests by community: communityId => requestIds[]
    mapping(uint256 => uint256[]) public communityRequests;
    
    /// @notice Comments by request: requestId => commentIds[]
    mapping(uint256 => uint256[]) public requestComments;
    
    /// @notice User request count for rate limiting: communityId => user => count
    mapping(uint256 => mapping(address => uint256)) public userRequestCount;
    
    /// @notice User last post time for rate limiting: communityId => user => timestamp
    mapping(uint256 => mapping(address => uint256)) public userLastPostTime;

    /// @notice Pre-approved winner for a request (set by moderators/governance)
    mapping(uint256 => address) public approvedWinner;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emitted when a new request is created
    event RequestCreated(
        uint256 indexed requestId,
        uint256 indexed communityId, 
        address indexed author,
        string title,
        string cid,
        string[] tags
    );
    
    /// @notice Emitted when a comment is posted
    event CommentPosted(
        uint256 indexed requestId,
        uint256 indexed commentId,
        address indexed author,
        string cid,
        uint256 parentCommentId
    );
    
    /// @notice Emitted when request status changes
    event RequestStatusChanged(
        uint256 indexed requestId,
        Status indexed newStatus,
        address indexed moderator
    );

    /// @notice Emitted when a comment is moderated
    /// @param requestId Parent request
    /// @param commentId Comment being moderated
    /// @param moderator Address performing moderation
    /// @param hidden Whether the comment is now hidden
    event CommentModerated(
        uint256 indexed requestId,
        uint256 indexed commentId,
        address indexed moderator,
        bool hidden
    );
    
    /// @notice Emitted when a bounty is configured for a request
    event BountyAdded(
        uint256 indexed requestId,
        uint256 indexed communityId,
        address indexed token,
        uint256 amount,
        address funder
    );
    
    /// @notice Emitted when a request is linked to a ValuableAction
    event ValuableActionLinking(
        uint256 indexed requestId,
        uint256 indexed valuableActionId,
        address indexed linker
    );

    /// @notice Emitted when a winner is approved for completion
    event ApprovedWinnerSet(
        uint256 indexed requestId,
        address indexed winner,
        address indexed setter
    );

    /// @notice Emitted when a one-shot engagement is completed atomically
    event OneShotEngagementCompleted(
        uint256 indexed requestId,
        address indexed winner,
        address bountyToken,
        uint256 bountyAmount,
        uint256 engagementTokenId
    );

    /// @notice Emitted when bounty funds are ready for manual payout via the community treasury vault
    event BountyReady(
        uint256 indexed requestId,
        uint256 indexed communityId,
        address indexed winner,
        address token,
        uint256 amount
    );
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param _communityRegistry Address of the community registry
    /// @param _valuableActionRegistry Address of ValuableActionRegistry
    constructor(address _communityRegistry, address _valuableActionRegistry) {
        if (_communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (_valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        communityRegistry = CommunityRegistry(_communityRegistry);
        valuableActionRegistry = IValuableActionRegistry(_valuableActionRegistry);
    }
    
    /*//////////////////////////////////////////////////////////////
                            REQUEST MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Create a new community request
    /// @param communityId Community to post in
    /// @param title Request title
    /// @param cid IPFS content hash
    /// @param tags Categorization tags
    /// @return requestId The created request ID
    function createRequest(
        uint256 communityId,
        string calldata title,
        string calldata cid,
        string[] calldata tags
    ) external returns (uint256 requestId) {
        _requireValidCommunity(communityId);
        _requireNotRateLimited(communityId, msg.sender);
        
        if (bytes(title).length == 0) revert Errors.InvalidInput("Title cannot be empty");
        if (bytes(cid).length == 0) revert Errors.InvalidInput("Content CID cannot be empty");
        
        requestId = nextRequestId++;
        
        Request storage request = requests[requestId];
        request.communityId = communityId;
        request.author = msg.sender;
        request.title = title;
        request.cid = cid;
        request.status = Status.OPEN_DEBATE;
        request.createdAt = uint64(block.timestamp);
        request.lastActivity = uint64(block.timestamp);
        request.tags = tags;
        
        // Add to community requests list
        communityRequests[communityId].push(requestId);
        
        // Update rate limiting
        userRequestCount[communityId][msg.sender]++;
        userLastPostTime[communityId][msg.sender] = block.timestamp;
        
        emit RequestCreated(requestId, communityId, msg.sender, title, cid, tags);
    }
    
    /// @notice Post a comment on a request
    /// @param requestId Request to comment on
    /// @param parentCommentId Parent comment ID (0 for top-level)
    /// @param cid IPFS content hash
    /// @return commentId The created comment ID
    function postComment(
        uint256 requestId,
        uint256 parentCommentId,
        string calldata cid
    ) external returns (uint256 commentId) {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        if (request.status == Status.FROZEN || request.status == Status.ARCHIVED) {
            revert Errors.InvalidInput("Request is not open for comments");
        }
        
        _requireNotRateLimited(request.communityId, msg.sender);
        
        if (bytes(cid).length == 0) revert Errors.InvalidInput("Content CID cannot be empty");
        
        // Validate parent comment if specified
        if (parentCommentId != 0) {
            Comment storage parentComment = comments[parentCommentId];
            if (parentComment.requestId != requestId) {
                revert Errors.InvalidInput("Parent comment not in this request");
            }
        }
        
        commentId = nextCommentId++;
        
        Comment storage comment = comments[commentId];
        comment.requestId = requestId;
        comment.author = msg.sender;
        comment.cid = cid;
        comment.parentCommentId = parentCommentId;
        comment.createdAt = uint64(block.timestamp);
        
        // Add to request comments list
        requestComments[requestId].push(commentId);
        
        // Update request activity
        request.lastActivity = uint64(block.timestamp);
        request.commentCount++;
        
        // Update rate limiting
        userLastPostTime[request.communityId][msg.sender] = block.timestamp;
        
        emit CommentPosted(requestId, commentId, msg.sender, cid, parentCommentId);
    }
    
    /*//////////////////////////////////////////////////////////////
                             MODERATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Change request status (moderator only)
    /// @param requestId Request to update
    /// @param newStatus New status
    function setRequestStatus(uint256 requestId, Status newStatus) external {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        
        _requireModerator(request.communityId, msg.sender);
        
        request.status = newStatus;
        emit RequestStatusChanged(requestId, newStatus, msg.sender);
    }
    
    /// @notice Moderate a comment (hide/unhide)
    /// @param commentId Comment to moderate
    /// @param hide Whether to hide the comment
    function moderateComment(uint256 commentId, bool hide) external {
        Comment storage comment = comments[commentId];
        if (comment.author == address(0)) revert Errors.InvalidInput("Comment does not exist");
        
        Request storage request = requests[comment.requestId];
        _requireModerator(request.communityId, msg.sender);
        
        comment.isModerated = hide;

        emit CommentModerated(comment.requestId, commentId, msg.sender, hide);
    }
    
    /*//////////////////////////////////////////////////////////////
                               BOUNTIES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Configure bounty token/amount for a request (mutable until winner approval)
    /// @param requestId Request to add bounty to
    /// @param token ERC20 token address used for payout
    /// @param amount Bounty amount
    function addBounty(uint256 requestId, address token, uint256 amount) external {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        if (token == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Bounty amount must be positive");
        if (approvedWinner[requestId] != address(0)) revert Errors.InvalidInput("Winner already approved");
        if (request.consumed) revert Errors.InvalidInput("Request already consumed");

        CommunityRegistry.Community memory community = communityRegistry.getCommunity(request.communityId);
        if (community.treasuryVault == address(0)) revert Errors.InvalidInput("Treasury vault not set");

        if (request.bountyToken != address(0) && request.bountyToken != token) {
            revert Errors.InvalidInput("Bounty token mismatch");
        }
        if (amount < request.bountyAmount) revert Errors.InvalidInput("Bounty cannot decrease");

        uint256 delta = amount - request.bountyAmount;
        if (delta > 0) {
            IERC20(token).safeTransferFrom(msg.sender, community.treasuryVault, delta);
        }

        request.bountyToken = token;
        request.bountyAmount = amount;
        
        emit BountyAdded(requestId, request.communityId, token, amount, msg.sender);
    }
    
    /// @notice Link request to a ValuableAction for work verification
    /// @param requestId Request ID to link
    /// @param valuableActionId ValuableAction to link to
    function linkValuableAction(uint256 requestId, uint256 valuableActionId) external {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        
        // Only request author or community admin can link ValuableActions
        if (msg.sender != request.author) {
            _requireCommunityAdmin(request.communityId, msg.sender);
        }
        
        request.linkedValuableAction = valuableActionId;
        emit ValuableActionLinking(requestId, valuableActionId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                    WINNER APPROVAL & COMPLETION
    //////////////////////////////////////////////////////////////*/

    /// @notice Approve a winner for a one-shot engagement (non-clearable)
    function setApprovedWinner(uint256 requestId, address winner) external {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        _requireModerator(request.communityId, msg.sender);
        if (winner == address(0)) revert Errors.ZeroAddress();
        if (approvedWinner[requestId] != address(0)) revert Errors.InvalidInput("Winner already approved");
        if (request.consumed) revert Errors.InvalidInput("Request already consumed");

        approvedWinner[requestId] = winner;
        emit ApprovedWinnerSet(requestId, winner, msg.sender);
    }

    /// @notice Complete a one-shot engagement: payout bounty and mint WORK engagement SBT atomically
    function completeEngagement(uint256 requestId, bytes calldata metadata)
        external
        nonReentrant
        returns (uint256 engagementTokenId)
    {
        Request storage request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
        if (request.linkedValuableAction == 0) revert Errors.InvalidInput("No valuable action linked");

        address winner = approvedWinner[requestId];
        if (winner == address(0)) revert Errors.InvalidInput("Winner not approved");
        if (request.consumed) revert Errors.InvalidInput("Request already consumed");
        if (msg.sender != winner) revert Errors.NotAuthorized(msg.sender);

        if (!valuableActionRegistry.isValuableActionActive(request.linkedValuableAction)) {
            revert Errors.InvalidValuableAction(request.linkedValuableAction);
        }
        Types.ValuableAction memory action = valuableActionRegistry.getValuableAction(request.linkedValuableAction);
        if (action.category != Types.ActionCategory.ENGAGEMENT_ONE_SHOT) {
            revert Errors.InvalidInput("Not a one-shot action");
        }

        // Mark consumed before external calls to prevent replays
        request.consumed = true;
        request.winner = winner;

        engagementTokenId = valuableActionRegistry.issueEngagement(
            request.communityId,
            winner,
            Types.EngagementSubtype.WORK,
            bytes32(request.linkedValuableAction),
            metadata
        );

        if (request.bountyAmount > 0) {
            emit BountyReady(requestId, request.communityId, winner, request.bountyToken, request.bountyAmount);
        }

        emit OneShotEngagementCompleted(requestId, winner, request.bountyToken, request.bountyAmount, engagementTokenId);
    }
    
    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get request details
    /// @param requestId Request ID
    /// @return request Request data
    function getRequest(uint256 requestId) external view returns (Request memory request) {
        request = requests[requestId];
        if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
    }
    
    /// @notice Get comment details
    /// @param commentId Comment ID
    /// @return comment Comment data
    function getComment(uint256 commentId) external view returns (Comment memory comment) {
        comment = comments[commentId];
        if (comment.author == address(0)) revert Errors.InvalidInput("Comment does not exist");
    }
    
    /// @notice Get all requests for a community
    /// @param communityId Community ID
    /// @return requestIds Array of request IDs
    function getCommunityRequests(uint256 communityId) external view returns (uint256[] memory) {
        return communityRequests[communityId];
    }
    
    /// @notice Get all comments for a request
    /// @param requestId Request ID
    /// @return commentIds Array of comment IDs
    function getRequestComments(uint256 requestId) external view returns (uint256[] memory) {
        return requestComments[requestId];
    }
    
    /// @notice Get requests by tag (view helper - off-chain filtering recommended for gas efficiency)
    /// @param communityId Community ID
    /// @param tag Tag to filter by
    /// @return requestIds Matching request IDs
    function getRequestsByTag(uint256 communityId, string calldata tag) 
        external 
        view 
        returns (uint256[] memory requestIds) 
    {
        uint256[] memory allRequests = communityRequests[communityId];
        uint256[] memory matching = new uint256[](allRequests.length);
        uint256 matchCount = 0;
        
        for (uint256 i = 0; i < allRequests.length; i++) {
            Request storage request = requests[allRequests[i]];
            for (uint256 j = 0; j < request.tags.length; j++) {
                if (keccak256(bytes(request.tags[j])) == keccak256(bytes(tag))) {
                    matching[matchCount++] = allRequests[i];
                    break;
                }
            }
        }
        
        // Resize array to actual match count
        requestIds = new uint256[](matchCount);
        for (uint256 i = 0; i < matchCount; i++) {
            requestIds[i] = matching[i];
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                            INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Require valid community
    /// @param communityId Community ID to validate
    function _requireValidCommunity(uint256 communityId) internal view {
        // Delegate to community registry
        try communityRegistry.getCommunity(communityId) returns (CommunityRegistry.Community memory) {
            // Community exists - validation successful
            return;
        } catch {
            revert Errors.InvalidInput("Community does not exist");
        }
    }
    
    /// @notice Require community moderator privileges
    /// @param communityId Community ID
    /// @param user User to check
    function _requireModerator(uint256 communityId, address user) internal view {
        if (!communityRegistry.hasRole(communityId, user, communityRegistry.MODERATOR_ROLE()) &&
            !communityRegistry.communityAdmins(communityId, user) &&
            !communityRegistry.hasRole(communityRegistry.DEFAULT_ADMIN_ROLE(), user)) {
            revert Errors.NotAuthorized(user);
        }
    }
    
    /// @notice Require community admin privileges
    /// @param communityId Community ID
    /// @param user User to check
    function _requireCommunityAdmin(uint256 communityId, address user) internal view {
        if (!communityRegistry.communityAdmins(communityId, user) &&
            !communityRegistry.hasRole(communityRegistry.DEFAULT_ADMIN_ROLE(), user)) {
            revert Errors.NotAuthorized(user);
        }
    }
    
    /// @notice Check rate limiting for user posts
    /// @param communityId Community ID
    /// @param user User to check
    function _requireNotRateLimited(uint256 communityId, address user) internal view {
        uint256 lastPost = userLastPostTime[communityId][user];
        
        // Skip rate limiting for first post (lastPost == 0)
        if (lastPost == 0) {
            return;
        }
        
        // Basic rate limiting: max 10 posts per day
        uint256 dayStart = (block.timestamp / 1 days) * 1 days;
        if (lastPost >= dayStart) {
            if (userRequestCount[communityId][user] >= 10) {
                revert Errors.InvalidInput("Rate limit exceeded");
            }
        }
        
        // Minimum time between posts: 1 minute
        if (block.timestamp - lastPost < 60) {
            revert Errors.InvalidInput("Post too soon after previous post");
        }
    }
}
