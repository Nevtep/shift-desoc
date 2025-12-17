# RequestHub Contract

## 🎯 Purpose & Role

RequestHub is the **decentralized discussion entry point** for community coordination in the Shift DeSoc ecosystem. It serves as an on-chain forum where community members post needs, collaborate on solutions, and escalate discussions into actionable governance proposals. This contract implements the critical "Community Coordination Layer" that bridges informal discussion with formal governance processes.

**Key Functions:**

- Community discussion forum with hierarchical commenting
- Request lifecycle management (OPEN_DEBATE → FROZEN → ARCHIVED)
- Moderation system with role-based access control
- Rate limiting and spam prevention mechanisms
- Bounty system for incentivizing work
- ValuableAction integration for work verification workflows

## 🏗️ Core Architecture

### Data Structures

```solidity
/// Main request entity containing discussion metadata and content
struct Request {
    uint256 communityId;      // Community ownership
    address author;           // Request creator
    string title;             // Human-readable title
    string cid;               // IPFS content hash
    Status status;            // OPEN_DEBATE | FROZEN | ARCHIVED
    uint64 createdAt;         // Creation timestamp
    uint64 lastActivity;      // Last comment time (activity tracking)
    string[] tags;            // Categorization for discovery
    uint256 commentCount;     // Discussion activity metrics
    uint256 bountyAmount;     // Optional financial incentive
    uint256 linkedValuableAction; // Work verification integration (0 if none)
}

/// Comment structure supporting threaded discussions
struct Comment {
    uint256 requestId;        // Parent request reference
    address author;           // Comment author
    string cid;               // IPFS content hash
    uint256 parentCommentId;  // Hierarchical threading (0 for top-level)
    uint64 createdAt;         // Creation timestamp
    bool isModerated;         // Hidden by moderator flag
}
```

### State Management

**Request Storage:**

```solidity
mapping(uint256 => Request) public requests;              // All requests by ID
mapping(uint256 => uint256[]) public communityRequests;   // Community → request IDs
uint256 public nextRequestId = 1;                         // Auto-incrementing IDs
```

**Comment Storage:**

```solidity
mapping(uint256 => Comment) public comments;              // All comments by ID
mapping(uint256 => uint256[]) public requestComments;     // Request → comment IDs
uint256 public nextCommentId = 1;                         // Auto-incrementing IDs
```

**Rate Limiting Storage:**

```solidity
mapping(uint256 => mapping(address => uint256)) public userRequestCount;  // Community → user → count
mapping(uint256 => mapping(address => uint256)) public userLastPostTime;  // Community → user → timestamp
```

## ⚙️ Key Functions & Logic

### Request Management

#### `createRequest(communityId, title, cid, tags) → requestId`

Creates new community discussion with validation and rate limiting:

```solidity
function createRequest(
    uint256 communityId,
    string calldata title,
    string calldata cid,
    string[] calldata tags
) external returns (uint256 requestId) {
    _requireValidCommunity(communityId);           // Verify community exists
    _requireNotRateLimited(communityId, msg.sender); // Anti-spam protection

    // Input validation
    if (bytes(title).length == 0) revert Errors.InvalidInput("Title cannot be empty");
    if (bytes(cid).length == 0) revert Errors.InvalidInput("Content CID cannot be empty");

    // Create request with initial OPEN_DEBATE status
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

    // Update community index and rate limiting
    communityRequests[communityId].push(requestId);
    userRequestCount[communityId][msg.sender]++;
    userLastPostTime[communityId][msg.sender] = block.timestamp;
}
```

### Comment System

#### `postComment(requestId, parentCommentId, cid) → commentId`

Supports threaded discussions with validation:

```solidity
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

    // Validate parent comment hierarchy
    if (parentCommentId != 0) {
        Comment storage parentComment = comments[parentCommentId];
        if (parentComment.requestId != requestId) {
            revert Errors.InvalidInput("Parent comment not in this request");
        }
    }

    // Create comment and update activity tracking
    commentId = nextCommentId++;
    Comment storage comment = comments[commentId];
    comment.requestId = requestId;
    comment.author = msg.sender;
    comment.cid = cid;
    comment.parentCommentId = parentCommentId;
    comment.createdAt = uint64(block.timestamp);

    // Update request metadata and indexes
    requestComments[requestId].push(commentId);
    request.lastActivity = uint64(block.timestamp);
    request.commentCount++;
    userLastPostTime[request.communityId][msg.sender] = block.timestamp;
}
```

### Moderation System

#### Role-Based Moderation

```solidity
function _requireModerator(uint256 communityId, address user) internal view {
    if (!communityRegistry.hasRole(communityId, user, communityRegistry.MODERATOR_ROLE()) &&
        !communityRegistry.communityAdmins(communityId, user) &&
        !communityRegistry.hasRole(communityRegistry.DEFAULT_ADMIN_ROLE(), user)) {
        revert Errors.NotAuthorized(user);
    }
}
```

**Moderation Powers:**

- `setRequestStatus(requestId, newStatus)` - Change request status (FROZEN to stop new comments)
- `moderateComment(commentId, hide)` - Hide/unhide individual comments
- All decisions appealable through governance process

### Rate Limiting System

#### Anti-Spam Protection

```solidity
function _requireNotRateLimited(uint256 communityId, address user) internal view {
    uint256 lastPost = userLastPostTime[communityId][user];

    // Skip rate limiting for first post (lastPost == 0)
    if (lastPost == 0) return;

    // Daily limit: max 10 posts per day
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
```

## 🛡️ Security Features

### Access Control Integration

- **Community Validation:** All operations validate community membership via `CommunityRegistry`
- **Role-Based Moderation:** Moderator and admin roles defined by community governance
- **Creator Privileges**: Request authors have special permissions for ValuableAction linking

### Rate Limiting & Spam Prevention

- **Time-based throttling:** 60-second minimum between posts
- **Daily limits:** Maximum 10 posts per user per community per day
- **First-post exception:** New users not penalized for lack of history
- **Community-scoped:** Rate limits applied per community, not globally

### Input Validation

```solidity
// Content validation
if (bytes(title).length == 0) revert Errors.InvalidInput("Title cannot be empty");
if (bytes(cid).length == 0) revert Errors.InvalidInput("Content CID cannot be empty");

// Hierarchy validation
if (parentCommentId != 0) {
    Comment storage parentComment = comments[parentCommentId];
    if (parentComment.requestId != requestId) {
        revert Errors.InvalidInput("Parent comment not in this request");
    }
}

// Community validation
try communityRegistry.getCommunity(communityId) returns (CommunityRegistry.Community memory) {
    // Community exists
} catch {
    revert Errors.InvalidInput("Community does not exist");
}
```

### Moderation Safeguards

- **Status Protection:** Frozen/archived requests prevent new comments
- **Governance Appeals:** All moderation decisions can be overruled by community governance
- **Audit Trail:** All status changes and comment moderation logged via events

## 🔗 Integration Points

### CommunityRegistry Integration

```solidity
// Community validation and metadata
CommunityRegistry public immutable communityRegistry;

// Role checking for moderation
function _requireModerator(uint256 communityId, address user) internal view {
    if (!communityRegistry.hasRole(communityId, user, communityRegistry.MODERATOR_ROLE()) &&
        !communityRegistry.communityAdmins(communityId, user)) {
        revert Errors.NotAuthorized(user);
    }
}
```

### ValuableAction Integration (Work Verification)

```solidity
// Link requests to work verification system
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
```

### Bounty System Integration

```solidity
// Add financial incentives to requests
function addBounty(uint256 requestId, uint256 amount) external {
    Request storage request = requests[requestId];
    if (request.author == address(0)) revert Errors.InvalidInput("Request does not exist");
    if (amount == 0) revert Errors.InvalidInput("Bounty amount must be positive");

    // TODO: Transfer tokens from sender to this contract
    // For now, just update the bounty amount
    request.bountyAmount += amount;

    emit BountyAdded(requestId, amount, msg.sender);
}
```

### Event System for Off-chain Integration

```solidity
// Core events for indexing and notifications
event RequestCreated(uint256 indexed requestId, uint256 indexed communityId, address indexed author, string title, string cid, string[] tags);
event CommentPosted(uint256 indexed requestId, uint256 indexed commentId, address indexed author, string cid, uint256 parentCommentId);
event RequestStatusChanged(uint256 indexed requestId, Status indexed newStatus, address indexed moderator);
event BountyAdded(uint256 indexed requestId, uint256 amount, address indexed funder);
event ValuableActionLinking(uint256 indexed requestId, uint256 indexed valuableActionId, address indexed linker);
```

## 📊 Economic Model

### Bounty System

- **Direct Incentives:** Community members can add bounties to requests to incentivize solutions
- **Token Agnostic:** Current implementation tracks amounts; token transfers to be implemented
- **Cumulative Bounties:** Multiple contributors can add to the same request's bounty pool
- **Governance Integration**: Bounty distribution linked to work verification through ValuableActions

### Rate Limiting Economics

- **Free First Posts:** No barriers for new community members
- **Quality Over Quantity:** Daily limits encourage thoughtful contributions
- **Community Scoped:** Active participation in multiple communities allowed

### Integration with Broader Token Economy

```solidity
// Future integration with CommunityToken for bounty payments
// Current placeholder shows architecture for token integration
function addBounty(uint256 requestId, uint256 amount) external {
    // TODO: Transfer tokens from sender to this contract
    // CommunityToken(communityToken).transferFrom(msg.sender, address(this), amount);
    request.bountyAmount += amount;
}
```

## 🎛️ Configuration Examples

### Deployment Configuration

```solidity
// Deploy with CommunityRegistry integration
RequestHub requestHub = new RequestHub(address(communityRegistry));
```

### Rate Limiting Parameters

```solidity
// Current hardcoded limits (future: governance configurable)
uint256 constant DAILY_POST_LIMIT = 10;           // Max posts per day per user per community
uint256 constant MIN_POST_INTERVAL = 60;          // Minimum 60 seconds between posts
uint256 constant RATE_LIMIT_WINDOW = 1 days;      // 24-hour rolling window
```

### Moderation Workflow

```solidity
// 1. Grant moderator role via CommunityRegistry
communityRegistry.grantCommunityRole(communityId, moderatorAddress, MODERATOR_ROLE);

// 2. Moderator can manage content
requestHub.setRequestStatus(spamRequestId, Status.FROZEN);     // Stop new comments
requestHub.moderateComment(inappropriateCommentId, true);     // Hide comment

// 3. Community can appeal via governance
// Governance proposal can override moderation decisions
```

## 🚀 Advanced Features

### Tag-Based Discovery

```solidity
// Efficient tag-based filtering for content discovery
function getRequestsByTag(uint256 communityId, string calldata tag) external view returns (uint256[] memory) {
    uint256[] memory allRequests = communityRequests[communityId];
    // Filter requests by tag (gas-intensive, recommend off-chain indexing)
    // Returns array of matching request IDs
}
```

### Activity Tracking

```solidity
// Request activity metrics for community health analysis
struct Request {
    uint64 createdAt;         // Creation time
    uint64 lastActivity;      // Last comment time
    uint256 commentCount;     // Discussion engagement level
    // ... other fields
}
```

### Hierarchical Comment Threading

```solidity
// Support for nested comment discussions
struct Comment {
    uint256 parentCommentId;  // 0 for top-level, commentId for replies
    // Enables building comment trees off-chain
}
```

### Future Enhancements

#### Governance Integration

- **Draft Escalation:** Integration with DraftsManager for proposal development
- **Consensus Signaling:** Community sentiment polling before formal votes
- **Automatic Escalation:** Time-based or engagement-based proposal triggers

#### Enhanced Moderation

```solidity
// Future moderation enhancements
struct ModerationAction {
    address moderator;
    uint256 timestamp;
    string reason;
    bool appealable;
}

// Community reputation influence on moderation immunity
// SBT-weighted moderation consensus requirements
```

#### Economic Enhancements

```solidity
// Future bounty system improvements
struct BountyDistribution {
    address[] recipients;      // Multiple solution contributors
    uint256[] amounts;         // Proportional distribution
    uint256 releaseTime;       // Time-locked release
}

// Integration with work verification for automatic bounty release
// Stake-to-post mechanism for high-quality discussions
```

#### Cross-Community Features

```solidity
// Future cross-community request sharing
function shareRequest(uint256 requestId, uint256 targetCommunityId) external;

// Alliance-based request visibility
// Federated discussion across community networks
```

## 📈 Usage Patterns

### Community Discussion Lifecycle

1. **Request Creation:** Community member identifies need/opportunity
2. **Discussion Phase:** Open debate and solution development
3. **Escalation:** High-engagement requests become formal proposals
4. **Work Assignment**: Requests linked to ValuableActions for verification
5. **Resolution:** Bounty distribution and request archival

### Moderation Workflows

1. **Proactive Moderation:** Moderators freeze problematic requests
2. **Reactive Moderation:** Comment-level content management
3. **Community Appeals:** Governance review of moderation decisions
4. **Policy Evolution:** Community-driven moderation guideline updates

### Integration Workflows

1. **Request → Claims**: Link requests to work verification via ValuableActions
2. **Discussion → Proposals:** RequestHub feeds into DraftsManager for formal governance
3. **Bounties → Payment:** Integration with CommunityToken for incentive distribution
4. **Activity → Reputation:** Discussion participation influences SBT scoring

This RequestHub implementation provides the foundational discussion layer for decentralized community coordination, enabling structured community needs identification, collaborative solution development, and seamless escalation to formal governance processes.
