# Shift System Layers

This document provides a comprehensive reference for the five architectural layers of the Shift DeSoc protocol. Each layer builds upon the previous, creating a complete system for community governance, work verification, and economic coordination.

---

## Layer 1: Community Coordination

**Purpose**: Foundation for community coordination, discussion, and collaborative decision-making before formal governance.

### Components

| Contract | Role |
|----------|------|
| **CommunityRegistry** | Single source of truth for community metadata, parameters, and module addresses |
| **RequestHub** | On-chain discussion forum for community needs and ideas |
| **DraftsManager** | Collaborative proposal development with versioning and review |
| **ParamController** | Dynamic parameter management with governance control |

### CommunityRegistry

Central registry managing community lifecycle, metadata, and module wiring.

**Key Functions**:
- `registerCommunity(params)` → communityId
- `updateCommunityParams(communityId, updates)` — Governance-only
- `setModuleAddress(communityId, moduleKey, address)` — Configure module wiring
- `grantRole(communityId, user, role)` — Assign community roles

**State**:
```solidity
struct Community {
    string name;
    string description;
    string metadataURI;
    uint256 debateWindow;
    uint256 voteWindow;
    uint256 executionDelay;
    uint256 minSeniority;
    uint256 proposalThreshold;
    address governor;
    address timelock;
    // ... module addresses
}
```

### RequestHub

On-chain discussion forum where community members post needs/ideas and collaborate on solutions.

**Key Functions**:
- `createRequest(title, cid, tags)` → requestId
- `postComment(requestId, parentId, cid)` → commentId
- `setStatus(requestId, status)` — Moderator-gated

**Status Flow**: `OPEN_DEBATE → FROZEN → ARCHIVED`

### DraftsManager

Multi-contributor proposal development with versioning before formal governance submission.

**Key Functions**:
- `createDraft(requestId, actions, cid)` → draftId
- `addContributor(draftId, contributor)` — Collaborative editing
- `snapshotVersion(draftId, newVersionCID)` — Immutable versioning
- `escalateToProposal(draftId, multiChoice, numOptions, description)` → proposalId

**Draft Lifecycle**: `DRAFTING → REVIEW → ESCALATED → WON/LOST`

### ParamController

Governance-controlled parameter oracle for all system configuration.

**Key Parameters**:
- Governance timing (debate window, vote window, execution delay)
- Verification settings (panel size, minimum approvals)
- Economic splits (workers %, treasury %, investors %)
- Fee configurations and limits

**Access**: All mutations require timelock execution.

**Workflow**: `Community Need → Discussion → Collaborative Draft → Review → Escalation to Governance`

---

## Layer 2: Democratic Governance

**Purpose**: Multi-choice democratic governance with timelock protection and nuanced decision-making.

### Components

| Contract | Role |
|----------|------|
| **ShiftGovernor** | OpenZeppelin Governor with multi-choice voting extensions |
| **CountingMultiChoice** | Weighted multi-option vote counting mechanism |
| **MembershipTokenERC20Votes** | Pure merit-based governance tokens |
| **TimelockController** | Execution delays and emergency override protection |

### ShiftGovernor

Governance orchestrator supporting both binary and multi-choice proposals.

**Key Functions**:
```solidity
// Binary proposal (standard OpenZeppelin)
function propose(targets, values, calldatas, description) → proposalId

// Multi-choice proposal (Shift innovation)
function proposeMultiChoice(targets, values, calldatas, description, numOptions) → proposalId

// Voting
function castVote(proposalId, support)
function castVoteMultiChoice(proposalId, weights[], reason)

// Execution flow
function queue(targets, values, calldatas, descriptionHash)
function execute(targets, values, calldatas, descriptionHash)
```

**Configuration**:
| Parameter | Default | Purpose |
|-----------|---------|---------|
| Voting Delay | 1 day | Prevents flash governance attacks |
| Voting Period | 5 days | Time for community participation |
| Quorum | 4% | Minimum participation required |

### CountingMultiChoice

Weighted preference distribution across multiple proposal options.

**Vote Distribution**:
- Voters distribute weight across options (must sum ≤ 100%)
- Example: 60% Option A, 40% Option B
- Supports nuanced preference expression vs binary yes/no

### MembershipTokenERC20Votes

**Core Principle**: "Governance power is EARNED, not bought"

**Token Properties**:
- Minted only when Engagements are approved for ValuableAction completion
- Cannot be purchased with ETH/USDC
- No staking rewards or airdrops
- Full ERC20Votes delegation capabilities
- Historical snapshots prevent vote manipulation

**Key Functions**:
```solidity
function mint(to, amount, reason) external onlyRole(MINTER_ROLE)
function delegate(delegatee) public
function getPastVotes(account, blockNumber) → uint256
```

**Workflow**: `Draft Escalation → Proposal Creation → Voting Period → Timelock Delay → Execution`

---

## Layer 3: Verification & Reputation

**Purpose**: Democratic work verification replacing economic bonding with community-elected verifiers.

### Components

| Contract | Role |
|----------|------|
| **ValuableActionRegistry** | Policy and definition layer for all valuable actions |
| **Engagements** | One-shot work submission and M-of-N verification |
| **CredentialManager** | Course-scoped credential applications |
| **PositionManager** | Position lifecycle with ROLE SBT on success |
| **VerifierPowerToken1155** | Non-transferable verifier power per community |
| **VerifierElection** | Governance-controlled verifier set management |
| **VerifierManager** | M-of-N juror selection and performance tracking |
| **ValuableActionSBT** | Soulbound tokens with 5 types (WORK, ROLE, CREDENTIAL, POSITION, INVESTMENT) |

### ValuableActionRegistry

Canonical policy layer defining all valuable actions and coordinating SBT issuance.

**Key Functions**:
```solidity
// Issuance functions (called by manager contracts)
function issueEngagement(communityId, recipient, subtype, actionTypeId, metadata) → tokenId
function issuePosition(communityId, recipient, roleTypeId, points, metadata) → tokenId
function issueInvestment(communityId, recipient, cohortId, weight, metadata) → tokenId
function issueRoleFromPosition(communityId, holder, roleTypeId, points, issuedAt, endedAt, outcome, metadata) → tokenId

// Position lifecycle
function closePositionToken(communityId, tokenId, outcome)
```

**ValuableAction Configuration**:
```solidity
struct ValuableAction {
    uint32 membershipTokenReward;   // Governance tokens on completion
    uint32 communityTokenReward;    // CommunityToken for salary basis
    uint32 jurorsMin;               // M (minimum approvals)
    uint32 panelSize;               // N (total jurors)
    uint32 verifyWindow;            // Time limit for verification
    uint32 cooldownPeriod;          // Time between engagements
    bool revocable;                 // Can governance revoke
    string evidenceSpecCID;         // IPFS evidence requirements
}
```

### Engagements

One-shot work verification with M-of-N juror voting.

**Lifecycle**: `Submit → Juror Selection → Voting → Resolution → SBT Minting`

**Key Functions**:
- `submit(typeId, evidenceCID)` → engagementId
- `verify(engagementId, approve)` — Juror voting
- `submitAppeal(engagementId, reason)` — Worker appeal

**Privacy Model**: Dual-layer (public aggregates + internal individual votes)

### CredentialManager

Course-scoped credential applications with designated verifier approval.

**Key Functions**:
```solidity
function defineCourse(courseId, communityId, verifier, active) — Gov/Mod only
function applyForCredential(courseId, evidence) → appId
function approveApplication(appId) → tokenId  // Mints CREDENTIAL SBT
function revokeCredential(tokenId, courseId, reason) — Governance only
```

**Lifecycle**: `Define Course → Apply → Verifier Approves → CREDENTIAL SBT Minted`

### PositionManager

Manages ongoing roles with Position SBTs and revenue participation.

**Key Functions**:
```solidity
function definePositionType(roleTypeId, communityId, points, active) — Gov/Mod
function applyForPosition(roleTypeId, evidence) → appId
function approveApplication(appId, metadata) → positionTokenId  // Registers with RevenueRouter
function closePosition(positionTokenId, outcome, evidence) → roleTokenId  // SUCCESS mints ROLE SBT
```

**Close Outcomes**:
| Outcome | Result |
|---------|--------|
| `SUCCESS` | ROLE Engagement SBT minted (certified history) |
| `NEUTRAL` | No SBT (governance may mint manually) |
| `NEGATIVE` | No SBT (misconduct/removal) |

### Verifier Power System (VPS)

Replaces economic staking with governance-controlled verifier elections.

**VerifierPowerToken1155**:
- ERC-1155 where token ID = community ID
- Non-transferable (transfers disabled)
- Only timelock can mint/burn power

**VerifierElection**:
- Manages verifier rosters per community
- Bans/unbans with reason CIDs
- Synchronizes with VPT balances

**VerifierManager**:
- Selects M-of-N panels from eligible verifiers
- Configurable weighting (uniform vs power-proportional)
- Reports fraud to VerifierElection

### ValuableActionSBT

Soulbound tokens representing all verified contributions.

**Token Types**:
```solidity
enum TokenKind {
    WORK,        // One-shot work completion
    ROLE,        // Certified past role (from Position closure)
    CREDENTIAL,  // Course/training completion
    POSITION,    // Active ongoing role
    INVESTMENT   // Investment cohort membership
}
```

**Properties**:
- Non-transferable (ERC721 transfers revert)
- WorkerPoints with time-based decay
- Governance can revoke for misconduct

**Workflow**: `Work Definition → Engagement Submission → Verifier Selection → M-of-N Voting → SBT Minting → Rewards`

---

## Layer 4: Economic Engine

**Purpose**: Cohort-based revenue distribution with ROI guarantees and automated waterfall mechanics.

### Components

| Contract | Role |
|----------|------|
| **CommunityToken** | 1:1 USDC-backed programmable currency |
| **CohortRegistry** | Investment cohort tracking with Target ROI |
| **RevenueRouter** | Waterfall distribution engine |
| **TreasuryAdapter** | Safe-module treasury spending controls |
| **InvestmentCohortManager** | Cohort lifecycle and investment issuance coordination |

### CommunityToken

1:1 USDC-backed stablecoin for community payments.

**Key Functions**:
```solidity
function mint(usdcAmount) → tokensIssued     // Deposit USDC, get tokens
function redeem(tokenAmount) → usdcRedeemed  // Burn tokens, get USDC
function withdrawFromTreasury(recipient, amount, reason) — TREASURY_ROLE
```

**Safety Features**:
- Emergency pause
- Delayed emergency withdrawal
- Backing ratio always ≥ 1:1

### CohortRegistry

Manages investment cohorts with immutable Target ROI terms.

**Cohort Structure**:
```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;      // e.g., 15000 = 150% (immutable)
    uint32 priorityWeight;    // Revenue priority (1-1000)
    uint256 investedTotal;
    uint256 recoveredTotal;
    bool active;              // Auto-deactivates when Target ROI reached
    bytes32 termsHash;        // Immutable terms
}
```

**Key Functions**:
```solidity
function createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active) → cohortId
function addInvestment(cohortId, investor, amount, tokenId) — ValuableActionRegistry only
function markRecovered(cohortId, amount) — RevenueRouter only
```

### RevenueRouter

Deterministic waterfall distribution.

**Distribution Order**:
1. **Workers Minimum** — Guaranteed share (e.g., 40%)
2. **Treasury Base** — Community reserve
3. **Investor Pool** — Distributed to active cohorts by weight
4. **Spillover** — Remaining funds per governance policy

**Key Functions**:
```solidity
function routeRevenue(communityId, token, amount) — DISTRIBUTOR_ROLE
function registerPosition(tokenId) — Called when Position assigned
function unregisterPosition(tokenId) — Called when Position closed
```

### TreasuryAdapter

Safe-module execution path for governed treasury spending.

**Guardrails**:
| Rule | Limit |
|------|-------|
| Frequency | Max 1 payment per week |
| Size | Max 10% of token balance per payment |
| Tokens | Stablecoin allowlist only |
| Control | Governance via Timelock only |

**Key Functions**:
```solidity
function executePayment(token, to, amount, reasonURI) — onlyTimelock, whenNotPaused
function emergencyWithdraw(token, to, amount) — onlyGovernorOrGuardian
function pause() / unpause()
```

### InvestmentCohortManager

Coordinates cohort lifecycle and Investment SBT issuance.

**Key Functions**:
```solidity
function createCohort(communityId, targetRoiBps, priorityWeight, termsHash, startAt, endAt, active) → cohortId
function setCohortActive(cohortId, active)
function issueInvestment(to, cohortId, weight, metadata) → tokenId  // Mints INVESTMENT SBT
```

**Workflow**: `Revenue Generation → Worker Pool → Treasury Reserve → Cohort Distribution → ROI Tracking → Auto-Completion`

---

## Layer 5: Commerce & Housing

**Purpose**: Community-specific applications including marketplace, co-housing, and project crowdfunding.

### Components

| Contract | Role |
|----------|------|
| **Marketplace** | Decentralized commerce with escrow |
| **CommerceDisputes** | Dispute resolution for commercial transactions |
| **HousingManager** | Co-housing coordination and reservations |
| **ProjectFactory** | ERC-1155 crowdfunding with milestone validation |

### Marketplace

Canonical commerce surface supporting goods, services, and module-driven products.

**Offer Kinds**: `GENERIC`, `HOUSING`, extensible to future adapters

**Order Lifecycle**:
1. Buyer initiates purchase
2. Marketplace escrows funds
3. For HOUSING: calls HousingManager.consume()
4. Seller marks fulfilled
5. 72-hour dispute window
6. Settlement via RevenueRouter

**Key Functions**:
```solidity
function createOffer(communityId, kind, productContract, productId, basePrice, ...) → offerId
function purchaseOffer(offerId, paymentToken, params) → orderId
function markOrderFulfilled(orderId)
function settleOrder(orderId) — After dispute window
function openOrderDispute(orderId, evidenceURI) — Buyer only
```

### CommerceDisputes

Dedicated dispute resolution separate from work verification.

**Outcomes** (MVP):
- `REFUND_BUYER` — Full escrow returned
- `PAY_SELLER` — Full settlement via RevenueRouter

**Key Functions**:
```solidity
function openDispute(communityId, disputeType, relatedId, buyer, seller, amount, evidenceURI) → disputeId
function finalizeDispute(disputeId, outcome)
```

**Integration**: Calls `IDisputeReceiver.onDisputeResolved()` to trigger refund/settlement.

### HousingManager

Co-housing inventory and reservation management implementing ModuleProduct interface.

**Unit Management**:
```solidity
struct HousingUnit {
    uint256 unitId;
    uint256 communityId;
    address unitToken;         // Ownership NFT
    uint256 basePricePerNight;
    bool staked;               // Available for community use
    bool listed;               // Active on Marketplace
}
```

**ModuleProduct Interface**:
```solidity
function quote(productId, params, basePrice) → finalPrice
function consume(productId, buyer, params, amountPaid) → reservationId
function onOrderSettled(productId, resourceId, outcome)
```

**Reservation Lifecycle**: `CONFIRMED → CHECKED_IN → CHECKED_OUT → CANCELLED`

**Cancellation Policy**: Global per community (min stay: 3 days or 30 days)

### ProjectFactory

ERC-1155 crowdfunding with milestone validation.

**Key Functions**:
```solidity
function createProject(creator, metadataCID, fundingToken) → projectId
function setProjectActive(projectId, active)
```

**Integration**: Projects can spawn Marketplace listings, allocate housing inventory, and configure cohorts for investor participation.

---

## Cross-Layer Integration Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 5: Commerce        │ Marketplace, HousingManager, Disputes  │
├───────────────────────────┼─────────────────────────────────────────┤
│  Layer 4: Economic        │ CommunityToken, RevenueRouter, Cohorts │
├───────────────────────────┼─────────────────────────────────────────┤
│  Layer 3: Verification    │ Engagements, VPS, SBTs, Managers       │
├───────────────────────────┼─────────────────────────────────────────┤
│  Layer 2: Governance      │ Governor, Counting, MembershipToken    │
├───────────────────────────┼─────────────────────────────────────────┤
│  Layer 1: Coordination    │ Registry, RequestHub, Drafts, Params   │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Flows**:
- Coordination → Governance: Drafts escalate to proposals
- Governance → All Layers: Timelock executes parameter changes
- Verification → Governance: Approved engagements mint MembershipTokens
- Verification → Economic: Positions register with RevenueRouter
- Economic → All: RevenueRouter distributes to workers, treasury, investors
- Commerce → Economic: Settlements route through RevenueRouter
- Commerce → Verification: Completed orders can trigger ValuableActions
