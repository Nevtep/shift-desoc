# PositionManager Contract

The PositionManager contract manages position definitions, applications, assignments, and closures for ongoing community roles. It coordinates with RevenueRouter for revenue participation and mints ROLE SBTs when positions close successfully.

## 🎯 Purpose & Role

The PositionManager serves as the **position lifecycle coordinator** that:

- Allows governance/moderators to define position types with point values
- Enables community members to apply for positions
- Coordinates position assignments with revenue participation registration
- Manages position closure with three possible outcomes (SUCCESS, NEUTRAL, NEGATIVE)
- Mints ROLE Engagement SBTs for successfully completed positions

Unlike one-shot Engagements, positions represent **ongoing operational roles** with continuous responsibilities and revenue participation.

## 🏗️ Core Architecture

### Position Type Definition

Position types define available roles within a community:

```solidity
struct PositionType {
    bytes32 roleTypeId;     // Unique identifier for this role type
    uint256 communityId;    // Community scope
    uint32 points;          // Contribution points (affects revenue share)
    bool active;            // Whether new applications accepted
}
```

**Key Properties**:
- Points determine relative weight in revenue distribution
- Role type IDs are unique identifiers (hash of role name)
- Governance or moderators control activation status

### Position Application

Applications track the assignment workflow:

```solidity
struct PositionApplication {
    address applicant;          // Person requesting position
    bytes32 roleTypeId;         // Which position type
    uint256 communityId;        // Community scope
    bytes evidence;             // Supporting documentation
    uint8 status;               // 1=pending, 2=approved
    uint256 positionTokenId;    // POSITION SBT (after approval)
}
```

### Close Outcomes

When a position ends, it must be closed with an explicit outcome:

```solidity
enum CloseOutcome {
    SUCCESS,    // Successful completion → ROLE SBT minted
    NEUTRAL,    // Mutual agreement → No automatic SBT
    NEGATIVE    // Misconduct/removal → No SBT
}
```

| Outcome | Examples | Result |
|---------|----------|--------|
| `SUCCESS` | End of contract, voluntary exit, role expiration | ROLE Engagement SBT minted |
| `NEUTRAL` | Reorganization, scope change, mutual agreement | No automatic SBT |
| `NEGATIVE` | Misconduct, emergency removal, slashing | No SBT (revocation only) |

## ⚙️ Key Functions & Logic

### Position Type Management

#### `definePositionType(bytes32 roleTypeId, uint256 communityId, uint32 points, bool active)`

**Purpose**: Create a new position type for the community.

**Access**: Governance or moderators only.

```solidity
function definePositionType(
    bytes32 roleTypeId, 
    uint256 communityId, 
    uint32 points, 
    bool active
) external onlyGovOrModerator {
    if (roleTypeId == bytes32(0)) revert Errors.InvalidInput("Missing roleTypeId");
    if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
    if (points == 0) revert Errors.InvalidInput("Points cannot be zero");

    positionTypes[roleTypeId] = PositionType({
        roleTypeId: roleTypeId,
        communityId: communityId,
        points: points,
        active: active
    });

    emit PositionTypeDefined(roleTypeId, communityId, points, active);
}
```

### Application Flow

#### `applyForPosition(bytes32 roleTypeId, bytes calldata evidence)`

**Purpose**: Submit an application for a position.

**Returns**: `appId` - Application identifier

```solidity
function applyForPosition(bytes32 roleTypeId, bytes calldata evidence) 
    external returns (uint256 appId) 
{
    PositionType memory positionType = positionTypes[roleTypeId];
    if (positionType.roleTypeId == bytes32(0)) 
        revert Errors.InvalidInput("Unknown roleTypeId");
    if (!positionType.active) 
        revert Errors.InvalidInput("Position type inactive");

    appId = nextAppId++;
    applications[appId] = PositionApplication({
        applicant: msg.sender,
        roleTypeId: roleTypeId,
        communityId: positionType.communityId,
        evidence: evidence,
        status: STATUS_PENDING,
        positionTokenId: 0
    });

    emit PositionApplied(appId, msg.sender, roleTypeId, positionType.communityId);
}
```

#### `approveApplication(uint256 appId, bytes calldata metadata)`

**Purpose**: Approve application, mint POSITION SBT, and register for revenue.

**Returns**: `positionTokenId` - Minted POSITION SBT token ID

**Access**: Governance or moderators only.

```solidity
function approveApplication(uint256 appId, bytes calldata metadata)
    external onlyGovOrModerator returns (uint256 positionTokenId)
{
    PositionApplication storage application = applications[appId];
    if (application.status != STATUS_PENDING) 
        revert Errors.InvalidInput("Application not pending");
    
    PositionType memory positionType = positionTypes[application.roleTypeId];
    if (!positionType.active) 
        revert Errors.InvalidInput("Position type inactive");

    // Issue POSITION SBT via ValuableActionRegistry
    positionTokenId = valuableActionRegistry.issuePosition(
        positionType.communityId,
        application.applicant,
        application.roleTypeId,
        positionType.points,
        metadata
    );

    // Register with RevenueRouter for revenue participation
    if (address(revenueRouter) == address(0)) 
        revert Errors.InvalidInput("RevenueRouter not set");
    revenueRouter.registerPosition(positionTokenId);

    application.status = STATUS_APPROVED;
    application.positionTokenId = positionTokenId;

    emit PositionAssigned(appId, application.applicant, positionTokenId);
}
```

### Position Closure

#### `closePosition(uint256 positionTokenId, CloseOutcome outcome, bytes calldata evidenceOrMetadata)`

**Purpose**: End a position and optionally mint ROLE SBT for successful completion.

**Returns**: `roleTokenId` - Minted ROLE SBT token ID (only for SUCCESS outcome)

**Access**: Governance or moderators only.

```solidity
function closePosition(
    uint256 positionTokenId, 
    CloseOutcome outcome, 
    bytes calldata evidenceOrMetadata
) external onlyGovOrModerator returns (uint256 roleTokenId) {
    
    // Validate position token
    IValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(positionTokenId);
    if (data.kind != IValuableActionSBT.TokenKind.POSITION) 
        revert Errors.InvalidInput("Not a position token");
    if (data.endedAt != 0) 
        revert Errors.InvalidInput("Position already closed");

    address holder = IERC721(address(valuableActionSBT)).ownerOf(positionTokenId);
    uint64 endedAt = uint64(block.timestamp);

    // Close the position token
    valuableActionRegistry.closePositionToken(data.communityId, positionTokenId, uint8(outcome));

    // Unregister from revenue participation
    revenueRouter.unregisterPosition(positionTokenId);

    // Only SUCCESS mints a ROLE Engagement SBT
    if (outcome == CloseOutcome.SUCCESS) {
        roleTokenId = valuableActionRegistry.issueRoleFromPosition(
            data.communityId,
            holder,
            data.roleTypeId,
            data.points,
            data.issuedAt,
            endedAt,
            uint8(outcome),
            evidenceOrMetadata
        );
    }

    emit PositionClosed(positionTokenId, holder, outcome, endedAt, roleTokenId);
}
```

## 🛡️ Security Features

### Access Control

| Function | Access |
|----------|--------|
| `definePositionType` | Governance or moderators |
| `applyForPosition` | Any community member |
| `approveApplication` | Governance or moderators |
| `closePosition` | Governance or moderators |
| `setModerator` | Governance only |
| `setRevenueRouter` | Governance only |

### Position Lifecycle Integrity

- Positions can only be closed once (`endedAt != 0` check)
- Revenue participation automatically starts on approval
- Revenue participation automatically ends on closure
- ROLE SBT only minted for SUCCESS outcome (reputation earned, not automatic)

### Revenue Router Integration

- `registerPosition()` called on approval — starts revenue participation
- `unregisterPosition()` called on closure — ends revenue participation
- RevenueRouter must be set before positions can be approved

## 🔗 Integration Points

### ValuableActionRegistry

- Issues POSITION SBTs via `issuePosition()`
- Closes position tokens via `closePositionToken()`
- Issues ROLE SBTs via `issueRoleFromPosition()` (SUCCESS only)

### ValuableActionSBT

- Queries token data for position validation
- Provides owner lookup for closed positions

### RevenueRouter

- Registers positions for revenue participation
- Unregisters positions on closure
- Distributes worker minimum pool to active positions by points

## 📊 Events

```solidity
event PositionTypeDefined(
    bytes32 indexed roleTypeId, 
    uint256 indexed communityId, 
    uint32 points, 
    bool active
);

event PositionApplied(
    uint256 indexed appId, 
    address indexed applicant, 
    bytes32 indexed roleTypeId, 
    uint256 communityId
);

event PositionAssigned(
    uint256 indexed appId, 
    address indexed applicant, 
    uint256 indexed positionTokenId
);

event PositionClosed(
    uint256 indexed positionTokenId,
    address indexed holder,
    CloseOutcome outcome,
    uint64 endedAt,
    uint256 roleTokenId  // 0 if not SUCCESS
);

event RevenueRouterUpdated(address indexed router);
```

## 📈 Economic Model

### Revenue Participation

While a position is active:
1. Position holder receives share of worker minimum pool
2. Share calculated by `position.points / totalActivePositionPoints`
3. Distribution happens through RevenueRouter waterfall

### Points System

- Points assigned when position type is defined
- Higher points = larger revenue share
- Points also recorded in ROLE SBT for historical reputation

### Position Value

```
Active Position:
  - POSITION SBT (non-transferable credential)
  - Revenue participation (ongoing income)
  - Community responsibilities

After SUCCESS Closure:
  - ROLE SBT (permanent reputation record)
  - No more revenue participation
  - Historical contribution documented
```

## 🎛️ Configuration & Governance

### Admin Functions

- `setModerator(address account, bool status)` — Grant/revoke moderator role
- `updateGovernance(address newGovernance)` — Transfer governance control
- `setRevenueRouter(address router)` — Configure revenue integration

### Querying

- `positionTypes[roleTypeId]` — Get position type configuration
- `applications[appId]` — Get application details

---

The PositionManager provides complete lifecycle management for ongoing community roles, ensuring that active contributions are rewarded through revenue participation while successful completions are permanently recorded as verifiable credentials via ROLE SBTs.
