# SHIFT SYSTEM — AI Reference Document

> **Purpose**: Unified AI-oriented reference for the Shift DeSoc system. This document consolidates architecture, layer specifications, and contract relationships into a single consumable resource for AI coding assistants.

## System Identity

**Shift DeSoc** is meta-governance technology — flexible infrastructure enabling communities to model any organizational structure. Rather than imposing a specific governance model, Shift provides building blocks (governance protocols, work verification systems, economic mechanisms) that communities configure to implement their unique decision-making processes.

**Core Flow**: `requests → drafts → proposals → timelock execution` with Engagement-based merit verification and token rewards.

**Contract Count**: 25 Solidity contracts (excluding libs/interfaces; includes ProjectFactory)

**Target Networks**: Base (primary), Ethereum (secondary), Base Sepolia (testing)

---

## Architecture Overview

### 5-Layer Stack

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: COMMERCE MODULES (4 contracts)                               │
│  Marketplace, CommerceDisputes, HousingManager, ProjectFactory         │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 4: ECONOMIC ENGINE (4 contracts)                                │
│  CommunityToken, CohortRegistry, RevenueRouter, TreasuryAdapter        │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: WORK VERIFICATION (9 contracts)                              │
│  ValuableActionRegistry, Engagements, VerifierPowerToken1155,          │
│  VerifierElection, VerifierManager, ValuableActionSBT,                 │
│  CredentialManager, PositionManager, InvestmentCohortManager           │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 2: DEMOCRATIC GOVERNANCE (4 contracts)                          │
│  ShiftGovernor, CountingMultiChoice, MembershipTokenERC20Votes,        │
│  TimelockController                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 1: COMMUNITY COORDINATION (4 contracts)                         │
│  CommunityRegistry, RequestHub, DraftsManager, ParamController         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Contract Suite (25 Total)

| Layer | Contract | Purpose |
|-------|----------|---------|
| **L1** | CommunityRegistry | Community metadata, module wiring, role management |
| **L1** | RequestHub | Discussion forum, idea coordination, moderation |
| **L1** | DraftsManager | Collaborative proposal development, versioning |
| **L1** | ParamController | Dynamic parameter management, governance control |
| **L2** | ShiftGovernor | Multi-choice governance engine, proposal lifecycle |
| **L2** | CountingMultiChoice | Weighted voting mechanism, preference distribution |
| **L2** | MembershipTokenERC20Votes | Merit-based governance tokens |
| **L2** | TimelockController | Execution delays, security protection |
| **L3** | ValuableActionRegistry | Community-defined engagement types |
| **L3** | Engagements | One-shot work verification workflow |
| **L3** | VerifierPowerToken1155 | Democratic verifier selection tokens |
| **L3** | VerifierElection | Verifier governance and elections |
| **L3** | VerifierManager | M-of-N juror selection |
| **L3** | ValuableActionSBT | Multi-type Soulbound tokens (5 types) |
| **L3** | CredentialManager | Course credential issuance |
| **L3** | PositionManager | Ongoing position lifecycle |
| **L3** | InvestmentCohortManager | Investment cohort coordination |
| **L4** | CommunityToken | 1:1 USDC-backed community currency |
| **L4** | CohortRegistry | Investment cohort storage and tracking |
| **L4** | RevenueRouter | Automated revenue distribution waterfall |
| **L4** | TreasuryAdapter | Treasury spending controls, Safe module |
| **L5** | Marketplace | Decentralized service marketplace |
| **L5** | CommerceDisputes | Commercial dispute resolution |
| **L5** | HousingManager | Co-housing coordination |
| **L5** | ProjectFactory | Project shell registry / future milestones |

---

## Layer 1: Community Coordination

### Purpose
Foundation for community coordination, discussion, and collaborative decision-making before formal governance.

### Components

**CommunityRegistry**
- Single source of truth for community metadata, parameters, module addresses
- Manages cross-community relationships and role-based permissions
- Stores identity, governance timing, eligibility rules, economic settings
- Authority expectation: Timelock-only for parameter/module writes (current admin shortcuts must be migrated)

**RequestHub**
- On-chain discussion forum for community needs and ideas
- Hierarchical comments with rate limiting and moderation
- Links requests to ValuableActions or bounties

**DraftsManager**
- Multi-contributor proposal development with versioning
- Action bundles for governance execution
- Status lifecycle: DRAFTING → REVIEW → FINALIZED → ESCALATED → WON/LOST
- Gaps: governance/config setters need Timelock gating; community/request existence validation pending

**ParamController**
- Central storage for governed configuration
- GovernanceParams, EligibilityParams, EconomicParams per community
- Timelock-controlled updates with validation

### Key Flow
```
Community Need → Discussion (RequestHub) → Collaborative Draft (DraftsManager) 
→ Review → Escalation to Governance
```

---

## Layer 2: Democratic Governance

### Purpose
Multi-choice democratic governance with timelock protection and nuanced decision-making.

### Components

**ShiftGovernor**
- OpenZeppelin Governor with multi-choice voting extensions
- Binary and multi-choice proposal creation
- Timelock-controlled execution

**CountingMultiChoice**
- Weighted multi-option vote counting
- Distribution percentages across options
- Snapshot-based voting power

**MembershipTokenERC20Votes**
- Pure merit-based governance token
- ONLY earned through verified work (not purchasable)
- Full ERC20Votes delegation capabilities

**TimelockController**
- Execution delays for all governance decisions
- Emergency override capabilities
- Role management for proposers/executors

### Key Flow
```
Draft Escalation → Proposal Creation → Voting Period → Timelock Delay → Execution
```

### Multi-Choice Voting
```solidity
// Voters distribute weight across options
function castVoteMultiChoice(
    uint256 proposalId,
    uint256[] calldata weights,  // Must sum ≤ 100%
    string calldata reason
) external;
```

---

## Layer 3: Work Verification

### Purpose
Democratic work verification replacing economic bonding with community-elected verifiers.

### Components

**ValuableActionRegistry**
- Community-defined engagement types with verification parameters
- Reward weights for MembershipToken, CommunityToken
- M-of-N juror configuration, cooldowns, evidence specs

**Engagements**
- One-shot work verification workflow
- Submission → Juror Selection → M-of-N Voting → Resolution
- Dual-layer privacy (public aggregates + internal per-juror votes)
- Appeals for revocable actions

**VerifierPowerToken1155**
- Non-transferable ERC-1155 encoding verifier power per community
- Token ID = community ID; balance = verifier weight
- Only timelock can mint/burn/transfer

**VerifierElection**
- Governance-managed verifier rosters
- Power distribution via VPT minting/burning
- Ban/unban capabilities with reason CIDs

**VerifierManager**
- Configurable M-of-N juror selection engine
- Reads ParamController for panel size, minimum approvals
- Fraud reporting channel to governance

**ValuableActionSBT**
- Multi-type Soulbound tokens (5 types: WORK, ROLE, CREDENTIAL, POSITION, INVESTMENT)
- Non-transferable credentials
- TokenKind enum determines issuance pathway

**CredentialManager**
- Course-scoped credential applications
- Designated verifier approval (instructor/certifier)
- Governance-only revocation

**PositionManager**
- Ongoing position lifecycle management
- RevenueRouter integration for revenue participation
- CloseOutcome: SUCCESS (→ ROLE SBT), NEUTRAL, NEGATIVE

**InvestmentCohortManager**
- Investment cohort lifecycle coordination
- Delegates to CohortRegistry for storage
- Issues INVESTMENT SBTs via ValuableActionRegistry

### Engagement Subtypes (from code)
- WORK: Engagements (one-shot contributions)
- ROLE: Engagements (one-shot role credential)
- CREDENTIAL: Engagements (one-shot credential issuance)
- Position and Investment are **not** engagement subtypes; they are separate token kinds minted via dedicated flows.

### SBT Token Kinds (5 total)

| TokenKind | Issued By | Purpose |
|-----------|-----------|---------|
| WORK | Engagements → ValuableActionSBT.mintEngagement | Completed one-shot contributions |
| ROLE | Engagements → mintEngagement (role subtype) and PositionManager → mintRoleFromPosition | Role credential (one-shot or derived from position close) |
| CREDENTIAL | Engagements → mintEngagement (credential subtype) | Course/training certifications |
| POSITION | PositionManager → mintPosition | Active ongoing roles |
| INVESTMENT | InvestmentCohortManager → mintInvestment | Investment participation |

### Verifier Power System (VPS)
**CRITICAL**: No economic bonding/staking. Verifier power is governance-controlled.
- Timelock is only authority for VPT mint/burn
- Community isolation (power in Community A doesn't affect B)
- Democratic elections replace self-bonding

---

## Layer 4: Economic Engine

### Purpose
Revenue distribution, investment management, and treasury operations.

### Components

**CommunityToken**
- 1:1 USDC-backed programmable currency
- Role-gated treasuries (MINTER, TREASURY, EMERGENCY)
- Emergency pause and delayed withdrawal flow

**CohortRegistry**
- Investment cohort storage with immutable terms
- Target ROI tracking and auto-deactivation
- Per-investor funding totals and recovery tracking

**RevenueRouter**
- Deterministic waterfall distribution
- Workers minimum → Treasury base → Investor pool → Spillover
- Reads splits from ParamController

**TreasuryAdapter**
- Safe module for community treasury (Gnosis Safe) — stub, implement guardrails
- Guardrails: 1 payment/week max, 10% balance cap per token
- Stablecoin allowlist, pause/emergencyWithdraw paths (expected in implementation)

### Revenue Waterfall
```
Revenue Input
    │
    ├─► Workers Minimum (workersBps)
    │
    ├─► Treasury Base (treasuryBps of remainder)
    │
    ├─► Investor Pool (distributed by cohort weight)
    │   └─► Auto-deactivates cohorts at Target ROI
    │
    └─► Spillover (to workers or treasury per policy)
```

### Key Invariants
- `USDC.balanceOf(CommunityToken) >= totalSupply()`
- `recoveredTotal <= investedTotal * targetRoiBps / 10000`
- TreasuryAdapter guardrails cannot be bypassed

---

## Layer 5: Commerce Modules

### Purpose
On-chain coordination for products, services, and co-housing.

### Components

**Marketplace**
- Canonical commerce exchange per community — stub (events only)
- OfferKind routing: GENERIC, HOUSING, future adapters (planned)
- Escrow management and settlement via RevenueRouter (planned)

**CommerceDisputes**
- Dedicated dispute resolution for commerce (separate from work verification)
- Binary outcomes: REFUND_BUYER, PAY_SELLER
- Prevents duplicate disputes per resource
- Authority expectation: Timelock-governed; current owner/authorized-caller model must be migrated

**HousingManager**
- Co-housing inventory and reservations — stub (events only)
- ModuleProduct interface for Marketplace integration (planned)
- Check-in/out lifecycle, cancellation policies (planned)

**ProjectFactory**
- Project shell registry (ERC-1155 association)
- Planned milestone validation and crowdfunding protections
- Authority expectation: Timelock-governed for project config

### Commerce vs Work Verification
**CRITICAL**: Keep domains separated.
- Engagements handles ValuableActions (work claims)
- CommerceDisputes handles commercial transactions
- Never route commerce disputes through Engagements

---

## Cross-Layer Integration

### Data Flow
```
CommunityRegistry (L1)
    │
    ├─► All modules read community config
    │
ParamController (L1)
    │
    ├─► Governance/Verification/Economic modules read parameters
    │
ShiftGovernor (L2)
    │
    ├─► Proposals execute via TimelockController
    │
ValuableActionRegistry (L3)
    │
    ├─► Engagements reads action configs
    ├─► CredentialManager/PositionManager/InvestmentCohortManager issue SBTs
    │
RevenueRouter (L4)
    │
    ├─► PositionManager registers/unregisters positions
    ├─► Marketplace settlement routes through
    │
CohortRegistry (L4)
    │
    └─► InvestmentCohortManager delegates storage
```

### Authority Chain
```
Community Member
    │
    └─► Proposes via DraftsManager
            │
            └─► Escalates to ShiftGovernor
                    │
                    └─► Queues in TimelockController
                            │
                            └─► Executes on Target Contract
```

---

## Security Invariants

### Non-Negotiable Constraints

1. **Timelock is the only authority** for privileged mutations
   - ParamController updates
   - Verifier power mint/burn
   - Treasury spends
   - Role assignments

2. **Verifier power is governance-controlled** (NO staking/bonding)
   - VerifierElection manages rosters via Timelock
   - VPT tokens are non-transferable
   - No self-registration for verifiers

3. **CommerceDisputes is separate** from work Engagements
   - Engagements for ValuableActions only
   - CommerceDisputes for Marketplace/Housing transactions

4. **TreasuryAdapter guardrails must not be bypassed**
   - ≤1 spend per week
   - ≤10% of token's Safe balance per spend
   - Stablecoin allowlist enforced
   - Pause + emergency withdraw path via governance/guardian

### Authority Expectations vs Current Gaps
- CommunityRegistry: current admin-based updates; must move parameter/module writes behind Timelock
- DraftsManager: config/governor updates and community/request validation missing
- CommerceDisputes: owner/authorized-caller model; must be Timelock-driven
- TreasuryAdapter, Marketplace, HousingManager: stubs; implement guardrails + Timelock wiring before use
- ParamController: remains single policy oracle; avoid duplicating configs elsewhere

### Access Control Summary

| Contract | Write Authority |
|----------|-----------------|
| CommunityRegistry | Timelock expected (current admin shortcuts to migrate) |
| ParamController | Timelock only |
| VerifierPowerToken1155 | Timelock only |
| VerifierElection | Timelock only |
| ValuableActionRegistry | Governance/moderators |
| Engagements | Workers (submit), Jurors (vote), Governance (revoke) |
| DraftsManager | Governance/moderators (needs Timelock gating on config) |
| CommerceDisputes | Timelock expected (current owner/authorized callers) |
| TreasuryAdapter | Timelock (spend), Governor/Guardian (pause) |
| CohortRegistry | RevenueRouter (recovery), ValuableActionSBT (investments) |
| ProjectFactory | Timelock expected |

---

## Terminology Reference

### Current Terms (Use These)
| Term | Description |
|------|-------------|
| **Engagements** | One-shot work verification contract (formerly Claims) |
| **ValuableActionSBT** | Multi-type soulbound tokens (formerly WorkerSBT) |
| **EngagementSubtype** | Enum (code): WORK, ROLE, CREDENTIAL |
| **Target ROI** | Investment return target (not "guaranteed" ROI) |
| **VPS** | Verifier Power System (governance-controlled, no staking) |

### Deprecated Terms (Do Not Use)
| Deprecated | Current |
|------------|---------|
| Claims | Engagements |
| ClaimManager | Engagements |
| WorkerSBT | ValuableActionSBT |
| WorkerPoints | Part of ValuableActionSBT |
| Bonding/Staking (for verifiers) | VPS (governance-controlled) |

---

## Development Reference

### Toolchain
- Solidity ^0.8.24 with OpenZeppelin 5.x
- Foundry for testing, Hardhat for deployment
- Coverage gate: ≥86% enforced

### Key Commands
```bash
pnpm forge:test          # Run tests
pnpm forge:cov           # Coverage report
pnpm cov:gate            # Enforce coverage threshold
pnpm hh:compile          # Compile contracts
```

### File Locations
- Contracts: `contracts/core/`, `contracts/modules/`, `contracts/tokens/`
- Shared libs: `contracts/libs/Errors.sol`, `contracts/libs/Types.sol`
- Deployments: `deployments/{network}.json`
- Docs: `docs/EN/` (human), `neuromancer/` (AI)

### After Contract Changes
1. Run tests and coverage
2. Sync ABIs: `node scripts/copy-ponder-abis.js && node scripts/copy-web-abis.js`
3. Update indexer mappings if events changed
4. Update documentation

---

## Quick Reference

### 25 Contracts by Layer
```
L1 (4): CommunityRegistry, RequestHub, DraftsManager, ParamController
L2 (4): ShiftGovernor, CountingMultiChoice, MembershipTokenERC20Votes, TimelockController
L3 (9): ValuableActionRegistry, Engagements, VerifierPowerToken1155, VerifierElection,
        VerifierManager, ValuableActionSBT, CredentialManager, PositionManager,
        InvestmentCohortManager
L4 (4): CommunityToken, CohortRegistry, RevenueRouter, TreasuryAdapter
L5 (4): Marketplace, CommerceDisputes, HousingManager, ProjectFactory
```

### 5 SBT Types
```
WORK       → Engagements (one-shot contributions)
ROLE       → Engagements (role subtype) and PositionManager (derived on close)
CREDENTIAL → Engagements (credential subtype)
POSITION   → PositionManager (active roles)
INVESTMENT → InvestmentCohortManager (investor participation)
```

### Core Invariants
```
1. Timelock = only authority for privileged ops
2. VPS = governance-controlled (no staking)
3. CommerceDisputes ≠ Engagements
4. TreasuryAdapter guardrails = sacred
```
