# CredentialManager Contract

The CredentialManager contract handles course-scoped credential applications with designated verifier approval and governance-only revocation. It manages the complete lifecycle from course definition through credential issuance.

## 🎯 Purpose & Role

The CredentialManager serves as the **credential issuance engine** that:

- Allows governance/moderators to define courses and training programs
- Enables community members to apply for credentials upon course completion
- Coordinates with designated verifiers (e.g., instructors) for approval
- Issues CREDENTIAL subtype SBTs via ValuableActionRegistry
- Supports governance-only revocation for misconduct

Unlike Engagements (which uses M-of-N juror panels), CredentialManager uses **single designated verifiers** per course—typically the instructor or certifying authority.

## 🏗️ Core Architecture

### Course Definition

Courses represent certifiable programs that can issue credentials:

```solidity
struct Course {
    uint256 communityId;    // Community scope
    address verifier;       // Designated approver (instructor/certifier)
    bool active;            // Whether new applications accepted
    bool exists;            // Course has been defined
}
```

**Key Properties**:
- Each course has exactly one designated verifier
- Courses are identified by `bytes32 courseId` (hash of course name/identifier)
- Governance or moderators can activate/deactivate courses
- Course parameters are immutable after creation

### Credential Application

Applications track the credential issuance workflow:

```solidity
struct CredentialApplication {
    address applicant;      // Person requesting credential
    bytes32 courseId;       // Which course
    uint256 communityId;    // Community scope
    uint8 status;           // 1=pending, 2=approved, 3=revoked
    uint256 tokenId;        // SBT token ID (after approval)
}
```

**Status Values**:
| Status | Value | Meaning |
|--------|-------|---------|
| `STATUS_PENDING` | 1 | Application submitted, awaiting approval |
| `STATUS_APPROVED` | 2 | Credential issued, SBT minted |
| `STATUS_REVOKED` | 3 | Credential revoked by governance |

## ⚙️ Key Functions & Logic

### Course Management

#### `defineCourse(bytes32 courseId, uint256 communityId, address verifier, bool active)`

**Purpose**: Create a new course that can issue credentials.

**Access**: Governance or moderators only.

**Process**:
1. Validate courseId is not empty
2. Validate communityId is valid
3. Validate verifier address is not zero
4. Ensure course doesn't already exist
5. Store course configuration

```solidity
function defineCourse(bytes32 courseId, uint256 communityId, address verifier, bool active)
    external onlyGovOrModerator
{
    if (courseId == bytes32(0)) revert Errors.InvalidInput("Missing courseId");
    if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
    if (verifier == address(0)) revert Errors.ZeroAddress();
    if (courses[courseId].exists) revert Errors.InvalidInput("Course already exists");

    courses[courseId] = Course({
        communityId: communityId,
        verifier: verifier,
        active: active,
        exists: true
    });

    emit CourseDefined(courseId, communityId, verifier, active);
}
```

#### `setCourseActive(bytes32 courseId, bool active)`

**Purpose**: Enable or disable new applications for a course.

**Access**: Governance or moderators only.

### Application Flow

#### `applyForCredential(bytes32 courseId, bytes calldata evidence)`

**Purpose**: Submit an application for course credential.

**Returns**: `appId` - Application identifier

**Validations**:
- Course must exist and be active
- Applicant must not already have this credential
- Applicant must not have a pending application

```solidity
function applyForCredential(bytes32 courseId, bytes calldata evidence) 
    external returns (uint256 appId) 
{
    Course memory course = courses[courseId];
    if (!course.exists) revert Errors.InvalidInput("Unknown courseId");
    if (!course.active) revert Errors.InvalidInput("Course inactive");
    if (hasCredential[courseId][msg.sender]) 
        revert Errors.InvalidInput("Credential already issued");
    if (pendingApplicationId[courseId][msg.sender] != 0) 
        revert Errors.InvalidInput("Application already pending");

    appId = nextAppId++;
    applications[appId] = CredentialApplication({
        applicant: msg.sender,
        courseId: courseId,
        communityId: course.communityId,
        status: STATUS_PENDING,
        tokenId: 0
    });

    pendingApplicationId[courseId][msg.sender] = appId;
    emit CredentialApplied(appId, msg.sender, courseId, course.communityId);
}
```

#### `approveApplication(uint256 appId)`

**Purpose**: Verifier approves application and mints CREDENTIAL SBT.

**Returns**: `tokenId` - Minted SBT token ID

**Access**: Course verifier or governance only.

```solidity
function approveApplication(uint256 appId) external returns (uint256 tokenId) {
    CredentialApplication storage application = applications[appId];
    if (application.status != STATUS_PENDING) 
        revert Errors.InvalidInput("Application not pending");
    
    Course memory course = courses[application.courseId];
    if (msg.sender != course.verifier && msg.sender != governance) {
        revert Errors.NotAuthorized(msg.sender);
    }
    
    // Issue CREDENTIAL SBT via ValuableActionRegistry
    bytes memory metadata = abi.encode(application.courseId, appId);
    tokenId = valuableActionRegistry.issueEngagement(
        course.communityId,
        application.applicant,
        Types.EngagementSubtype.CREDENTIAL,
        application.courseId,
        metadata
    );

    application.status = STATUS_APPROVED;
    application.tokenId = tokenId;
    hasCredential[application.courseId][application.applicant] = true;
    pendingApplicationId[application.courseId][application.applicant] = 0;
    
    emit CredentialIssued(appId, tokenId, application.applicant, 
        application.courseId, course.communityId);
}
```

### Revocation

#### `revokeCredential(uint256 tokenId, bytes32 courseId, bytes calldata reason)`

**Purpose**: Governance revokes a credential for misconduct.

**Access**: Governance only.

**Process**:
1. Validate token is a CREDENTIAL type
2. Validate token matches the specified course
3. Validate token hasn't already been closed
4. Mark token as ended via SBT contract
5. Update application status to REVOKED
6. Store revocation metadata

```solidity
function revokeCredential(uint256 tokenId, bytes32 courseId, bytes calldata reason) 
    external onlyGovernance 
{
    ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
    if (data.kind != ValuableActionSBT.TokenKind.CREDENTIAL) 
        revert Errors.InvalidInput("Not a credential token");
    if (data.actionTypeId != courseId) 
        revert Errors.InvalidInput("Course mismatch");
    if (data.endedAt != 0) 
        revert Errors.InvalidInput("Credential already closed");

    sbt.setEndedAt(tokenId, uint64(block.timestamp));
    revocationMetadata[tokenId] = abi.encode(courseId, reason);

    uint256 appId = applicationIdByToken[tokenId];
    if (appId != 0) {
        applications[appId].status = STATUS_REVOKED;
    }

    emit CredentialRevoked(tokenId, courseId, sbt.ownerOf(tokenId), reason);
}
```

## 🛡️ Security Features

### Access Control

| Function | Access |
|----------|--------|
| `defineCourse` | Governance or moderators |
| `setCourseActive` | Governance or moderators |
| `applyForCredential` | Any community member |
| `approveApplication` | Designated verifier or governance |
| `revokeCredential` | Governance only |
| `setModerator` | Governance only |

### Duplicate Prevention

- Cannot apply if already holding the credential
- Cannot apply if application already pending
- Cannot define course if courseId already exists

### Immutability

- Course parameters cannot be changed after creation
- Issued credentials are permanent (revocation marks end, doesn't delete)
- Application history preserved for audit trail

## 🔗 Integration Points

### ValuableActionRegistry

- Issues CREDENTIAL SBTs via `issueEngagement()`
- Passes community ID, recipient, subtype, action type ID, and metadata

### ValuableActionSBT

- Queries token data for revocation validation
- Sets `endedAt` timestamp on revocation

### CommunityRegistry

- Validates community IDs
- Provides community context for credentials

## 📊 Events

```solidity
event CourseDefined(
    bytes32 indexed courseId, 
    uint256 indexed communityId, 
    address indexed verifier, 
    bool active
);

event CourseActivationUpdated(bytes32 indexed courseId, bool active);

event CredentialApplied(
    uint256 indexed appId, 
    address indexed applicant, 
    bytes32 indexed courseId, 
    uint256 communityId
);

event CredentialIssued(
    uint256 indexed appId,
    uint256 indexed tokenId,
    address indexed applicant,
    bytes32 courseId,
    uint256 communityId
);

event CredentialRevoked(
    uint256 indexed tokenId, 
    bytes32 indexed courseId, 
    address indexed applicant, 
    bytes metadata
);
```

## 🎛️ Configuration & Governance

### Admin Functions

- `setModerator(address account, bool status)` — Grant/revoke moderator role
- `updateGovernance(address newGovernance)` — Transfer governance control

### Querying

- `getCourse(bytes32 courseId)` — Get course configuration
- `getApplication(uint256 appId)` — Get application details
- `hasCredential[courseId][user]` — Check if user holds credential
- `pendingApplicationId[courseId][user]` — Check for pending application

---

The CredentialManager provides a streamlined path from course completion to verifiable on-chain credentials, enabling communities to certify training, skills, and achievements with designated authority approval and full audit trails.
