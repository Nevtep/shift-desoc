# Shift DeSoc Protocol — Feature & Use-Case Documentation

> **Auto-generated analysis of the Shift smart-contract suite**
> Contracts folder: `contracts/`

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Feature Areas](#3-feature-areas)
   - 3.1 [Governance System](#31-governance-system)
   - 3.2 [Community Management](#32-community-management)
   - 3.3 [Valuable Action & Engagement System](#33-valuable-action--engagement-system)
   - 3.4 [Verifier / Jury System (VPT)](#34-verifier--jury-system-vpt)
   - 3.5 [Credential Management](#35-credential-management)
   - 3.6 [Position & Role Management](#36-position--role-management)
   - 3.7 [Investment Cohort System](#37-investment-cohort-system)
   - 3.8 [Revenue Distribution (Revenue Router)](#38-revenue-distribution-revenue-router)
   - 3.9 [Marketplace & Commerce](#39-marketplace--commerce)
   - 3.10 [Commerce Dispute Resolution](#310-commerce-dispute-resolution)
   - 3.11 [Co-Housing Manager](#311-co-housing-manager)
   - 3.12 [Request Hub (Community Forum)](#312-request-hub-community-forum)
   - 3.13 [Drafts Manager (Collaborative Proposals)](#313-drafts-manager-collaborative-proposals)
   - 3.14 [Treasury Adapter](#314-treasury-adapter)
   - 3.15 [Parameter Controller](#315-parameter-controller)
   - 3.16 [Token System](#316-token-system)
   - 3.17 [Soulbound Token (SBT) System](#317-soulbound-token-sbt-system)
   - 3.18 [Project Factory](#318-project-factory)
4. [Cross-Cutting Concerns](#4-cross-cutting-concerns)
5. [Design Notes](#5-design-notes-clarified)

---

## 1. Platform Overview

**Shift** is a **Decentralized Social (DeSoc)** protocol that enables communities to self-organize, govern, invest, and transact on-chain. It combines:

- **On-chain governance** with multi-choice voting
- **Work verification** through jury panels and soulbound tokens
- **Investment cohorts** with guaranteed target-ROI mechanics
- **Revenue distribution** among workers, investors, and community treasuries
- **A marketplace** for community commerce (services, housing)
- **Credential and position** lifecycle management

The system is designed around the concept of **communities** — each community is an independent DAO-like entity with its own governance, token economy, verifier set, treasury, and marketplace.

---

## 2. Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                        CORE LAYER                              │
│   ShiftGovernor  ←→  CountingMultiChoice                       │
│   (OZ Governor + multi-choice voting + AccessManager timelock) │
└─────────────┬──────────────────────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                     MODULE LAYER                                │
│                                                                 │
│  CommunityRegistry  ──  ParamController                        │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────┐             │
│  │  ValuableActionRegistry  ←→  ValuableActionSBT │             │
│  │  Engagements (M-of-N jury verification)        │             │
│  │  CredentialManager                             │             │
│  │  PositionManager                               │             │
│  │  InvestmentCohortManager ←→ CohortRegistry     │             │
│  │  RevenueRouter (pull-based index distribution)  │             │
│  │  Marketplace ←→ HousingManager                  │             │
│  │  CommerceDisputes                               │             │
│  │  RequestHub (community forum + bounties)        │             │
│  │  DraftsManager (collaborative proposals)        │             │
│  │  TreasuryAdapter (Safe tx builder)              │             │
│  │  VerifierElection ←→ VerifierManager            │             │
│  │  ProjectFactory                                 │             │
│  └─────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
              │
┌─────────────▼──────────────────────────────────────────────────┐
│                      TOKEN LAYER                                │
│  CommunityToken (USDC-backed stablecoin)                       │
│  MembershipTokenERC20Votes (governance / voting power)         │
│  VerifierPowerToken1155 (per-community verifier power)         │
│  ValuableActionSBT (non-transferable ERC-721)                  │
└─────────────────────────────────────────────────────────────────┘
```

**Access Control**: All privileged operations use OpenZeppelin `AccessManaged` bound to a shared `AccessManager`. A canonical `Roles` library defines 15 system-level uint64 role IDs plus 3 community-scoped bytes32 roles (governance, moderator, curator).

---

## 3. Feature Areas

### 3.1 Governance System

**Contracts**: `ShiftGovernor`, `CountingMultiChoice`

#### Features

| Feature | Description |
|---|---|
| **Standard Binary Voting** | Traditional For/Against/Abstain voting via OpenZeppelin GovernorCountingSimple. |
| **Multi-Choice Voting** | Proposals can define 2–10 options; voters distribute their weight as percentages across options (weights sum ≤ 1e18). |
| **Quorum Fraction** | 4% quorum fraction of total voting supply. |
| **Timelock Integration** | `GovernorTimelockAccess` integrates with `AccessManager` delay-based timelocks. |
| **Configurable Settings** | 1-day voting delay, 5-day voting period, 0 proposal threshold (adjustable). |
| **Proposal Cancellation** | Multi-choice state is cleaned up properly when proposals are cancelled. |
| **Vote Preview** | Users can preview how their weight distributes across options before casting. |
| **Winning Option Detection** | On-chain function to determine the winning option and its vote count. |

#### Use Cases

1. **Community budget allocation**: A community proposes how to allocate its quarterly budget across 5 options (education, infrastructure, marketing, reserves, salaries). Members distribute their voting weight proportionally across preferences.
2. **Policy decisions**: Binary yes/no votes on policy changes (e.g., changing fee structure).
3. **Verifier election oversight**: Governance proposals to ban or reinstate verifiers.
4. **Module upgrades**: Timelock-delayed execution of contract upgrades or parameter changes.

---

### 3.2 Community Management

**Contracts**: `CommunityRegistry`, `ParamController`

#### Features

| Feature | Description |
|---|---|
| **Community Registration** | Any address can create a new community with name, description, metadata URI, and optional parent community. |
| **Hierarchical Communities** | Communities can have parent-child relationships and form alliances. |
| **Module Registry** | Each community tracks 14 module addresses (governor, timelock, requestHub, draftsManager, engagements, valuableActionRegistry, VPT, verifierElection, verifierManager, SBT, treasuryVault, treasuryAdapter, communityToken, paramController). |
| **Role Management** | Community-scoped roles: Governance, Moderator, Curator — granted and revoked per-community. |
| **Admin System** | Community creators become admins; admin privileges required for module address updates. |
| **Bulk Module Setup** | `setModuleAddresses()` allows configuring all 14 module addresses in a single transaction. |
| **Default Parameters** | `initializeDefaultParameters()` seeds governance, economic, and verifier parameters via ParamController. |

#### Use Cases

1. **DAO creation**: A cooperative creates a community, sets up governance, deploys its token, and registers all module contracts.
2. **Sub-community spawning**: A regional chapter creates a child community linked to the national parent organization.
3. **Cross-community alliances**: Communities form alliances for shared resource pools or mutual aid.

---

### 3.3 Valuable Action & Engagement System

**Contracts**: `ValuableActionRegistry`, `Engagements`, `ValuableActionSBT`

#### Features

| Feature | Description |
|---|---|
| **Valuable Action Definitions** | Configurable action templates with reward amounts (membership, community token, investor SBT), verification policy (none, fixed, role-based, jury, multisig), cooldown, max concurrent, evidence requirements, and governance thresholds. |
| **Governance-Gated Creation** | New valuable actions require a governance proposal reference and explicit activation step. |
| **M-of-N Jury Verification** | Engagements are verified by a randomly-selected jury panel; majority approval/rejection triggers resolution. |
| **Automatic Reward Issuance** | On approval: MembershipToken minted for governance power, engagement SBT issued, cooldown set. |
| **Appeal System** | Rejected engagements can be appealed by the participant. Appeal resolution is planned via integration with **Kleros** (or other decentralized arbitration protocols) for external, impartial jury adjudication. |
| **Revocation** | Governance can revoke approved engagements for action types marked as revocable. |
| **Fraud Reporting** | Jurors who vote against the final outcome are automatically reported to VerifierManager for governance review. |
| **Cooldown Enforcement** | Per-participant, per-action-type cooldown period prevents spam submissions. |
| **Max Concurrent Limit** | Action types can limit how many active engagements a participant may have simultaneously. |
| **Issuance Pausing** | Global pause switch for SBT issuance in emergencies. |
| **Community Narrowing** | Per-community allowlists restrict which modules can issue SBTs. |
| **Founder Bootstrap** | Founder whitelist for initial community setup before governance is fully operational. |

#### Use Cases

1. **Verify community work**: A member completes a community garden project, submits photo/GPS evidence via IPFS, and 3 of 5 jurors verify the work → SBT minted + governance tokens earned.
2. **Skill verification**: A member submits evidence of completing a construction task; the M-of-N jury verifies quality and awards points.
3. **Automatic fraud detection**: If jurors vote incorrectly (against the majority), they are flagged for governance review and potential banning.
4. **Recurring contributions**: Monthly volunteer work, enforced by 30-day cooldown between submissions.

---

### 3.4 Verifier / Jury System (VPT)

**Contracts**: `VerifierPowerToken1155`, `VerifierElection`, `VerifierManager`

#### Features

| Feature | Description |
|---|---|
| **Per-Community Verifier Power** | ERC-1155 tokens where tokenId = communityId; balance = verifier power weight. |
| **Non-Transferable** | Regular transfers disabled; only governance-authorized admin transfers allowed. |
| **Governance-Elected Sets** | `setVerifierSet()` atomically updates the entire verifier set — minting new power, burning excess, removing departed verifiers. |
| **Weighted Juror Selection** | Juror panels can be selected uniformly or weighted by VPT balance (configurable per community). |
| **Fraud & Ban System** | Verifiers can be banned (power burned, marked as banned), unbanned, or have power individually adjusted. |
| **Community Initialization** | Each community must be initialized before VPT can be issued for it. |
| **Batch Operations** | Batch mint/burn for efficient verifier set changes. |
| **Panel Tracking** | Each engagement's juror selection is recorded (jurors, powers, seed, timestamp). |
| **Max Weight Cap** | Per-community configurable maximum weight per verifier to prevent centralization. |

#### Use Cases

1. **Elect community verifiers**: Governance votes to elect 10 community verifiers with weighted power (e.g., experienced verifiers get more weight).
2. **Juror selection for work verification**: When a member submits an engagement, the system randomly selects 5 jurors from eligible verifiers.
3. **Ban fraudulent verifiers**: After repeated incorrect votes, governance bans a verifier — all their VPT is burned and they're excluded from future panels.
4. **Rebalance power**: Governance adjusts individual verifier power based on performance metrics.

---

### 3.5 Credential Management

**Contract**: `CredentialManager`

#### Features

| Feature | Description |
|---|---|
| **Course Definitions** | Governance defines courses with a specific verifier and community scope. |
| **Application Flow** | Members apply for credentials; designated course verifier or AccessManager-authorized caller approves. |
| **SBT Issuance** | On approval, a CREDENTIAL-typed engagement SBT is minted via ValuableActionRegistry. |
| **Governance-Only Revocation** | Credentials can only be revoked by governance (restricted function), with reason stored on-chain. |
| **Duplicate Prevention** | One credential per (courseId, applicant) pair; no double issuance or duplicate pending applications. |
| **Course Activation** | Courses can be activated/deactivated by governance. |
| **Metadata Tracking** | Both issuance and revocation metadata stored for auditability. |

#### Use Cases

1. **Professional certification**: A community defines a "Certified Electrician" course. Members complete training, apply, and the designated verifier approves — a soulbound credential SBT is minted.
2. **Academic credentials**: Community-recognized course completions tracked immutably on-chain.
3. **Credential revocation**: If fraud is discovered, governance revokes the credential SBT with documented reason.

---

### 3.6 Position & Role Management

**Contract**: `PositionManager`

#### Features

| Feature | Description |
|---|---|
| **Position Type Definitions** | Governance defines position types (e.g., "Project Lead", "Treasurer") with community scope, points, and active status. |
| **Application & Approval** | Members apply with evidence; governance approves, minting a POSITION SBT. |
| **Revenue Router Registration** | Approved positions are automatically registered with RevenueRouter for revenue share. |
| **Position Closure** | Positions are closed with an outcome (SUCCESS, NEUTRAL, NEGATIVE); on SUCCESS, a historical ROLE SBT is minted preserving the tenure record. |
| **Revenue Unregistration** | Closed positions are unregistered from RevenueRouter, stopping revenue accrual. |
| **Full Lifecycle Tracking** | Position SBTs record issuedAt, endedAt, outcome, and points — creating an immutable career record. |

#### Use Cases

1. **Assign a project lead**: A member applies for "Project Lead" role, governance approves → POSITION SBT minted with 100 points → member starts earning proportional revenue share.
2. **Term completion**: After 6 months, governance closes the position with SUCCESS outcome → historical ROLE SBT minted recording the tenure → revenue share stops.
3. **Performance-based closure**: Poor-performing position holders can be closed with NEGATIVE outcome (no role SBT minted).

---

### 3.7 Investment Cohort System

**Contracts**: `CohortRegistry`, `InvestmentCohortManager`

#### Features

| Feature | Description |
|---|---|
| **Cohort Creation** | Governance creates investment cohorts with immutable terms: target ROI (basis points), priority weight, terms hash, optional schedule (startAt/endAt). |
| **Target ROI Guarantee** | Each cohort has a target ROI (e.g., 150%); the cohort remains active until total recovered ≥ invested × target. |
| **Investment Recording** | Investments are linked to SBT tokens; per-investor and per-token amounts tracked. |
| **Revenue Recovery** | RevenueRouter calls `markRecovered()` on each distribution cycle to track how much revenue has been routed to each cohort (confirmed: RevenueRouter is the caller). |
| **Automatic Completion** | Cohorts are automatically deactivated when target ROI is met. |
| **Priority Weighting** | Higher priority cohorts receive a larger share of revenue distribution. |
| **Investor SBT Issuance** | Investment issuance creates an INVESTMENT SBT token for the investor. |
| **Schedule Constraints** | Cohorts can have start/end times; expired cohorts reject new investments. |

#### Use Cases

1. **Community housing fund**: Create a cohort with 120% target ROI; investors deposit funds, receive investment SBTs, and earn proportional revenue until 120% recovered.
2. **Seed round**: Early investors get higher priority weight for faster capital recovery.
3. **Time-limited fundraise**: Cohort with startAt = January 1, endAt = March 31 — only accepts investments during Q1.
4. **Automatic graduation**: Once a cohort reaches its target ROI, it deactivates and stops receiving revenue, freeing funds for other cohorts.

---

### 3.8 Revenue Distribution (Revenue Router)

**Contract**: `RevenueRouter`

#### Features

| Feature | Description |
|---|---|
| **Deterministic Revenue Splitting** | Each revenue event is split between: treasury (min guarantee), positions (min guarantee), investment cohorts, and spillover. |
| **Pull-Based Index System** | Uses a scalable index mechanism (similar to Synthetix staking) — position holders and investors claim proportional shares without iteration. |
| **Minimum Guarantees** | Treasury and positions have configurable minimum BPS allocations. |
| **Spillover Mechanics** | Residual revenue (after cohort distribution) flows to configurable targets: positions, treasury, or a split between both. |
| **Position Claiming** | Position SBT holders call `claimPosition()` to withdraw accrued revenue based on their points and index delta. |
| **Investment Claiming** | Investment SBT holders call `claimInvestment()` to withdraw accrued revenue based on their cohort weight and index delta. |
| **Treasury Withdrawal** | Community treasury (Safe) calls `withdrawTreasury()` to access accrued funds. |
| **Multi-Token Support** | Revenue routing works with any supported ERC-20 token per community. |
| **Automatic Remainder** | Any unallocated dust from rounding is swept to treasury. |

#### Use Cases

1. **Worker payment**: A community earns 10,000 USDC from marketplace sales; 20% goes to treasury, 30% to position holders (proportional to points), remainder to investor cohorts.
2. **Position holder claim**: A "Project Manager" with 200 out of 1,000 total position points claims 20% of the positions pool.
3. **Investor recovery**: An investor holding 10% of a cohort's weight claims 10% of revenue allocated to that cohort.
4. **Spillover**: If no active cohorts exist, all remaining revenue flows to positions or treasury based on community policy.

---

### 3.9 Marketplace & Commerce

**Contract**: `Marketplace`

#### Features

| Feature | Description |
|---|---|
| **Multi-Type Offers** | GENERIC (simple services/products) and HOUSING (via HousingManager adapter). Extensible for future types. |
| **Dual Payment** | Offers can accept community tokens, stablecoins, or both. |
| **Community Token Discounts** | Configurable BPS discount when paying with community token (incentivizes local economy). |
| **Escrow-Based Fulfillment** | Purchase → funds escrowed → seller marks fulfilled → 3-day dispute window → settlement. |
| **ModuleProduct Integration** | HOUSING and future offer types delegate pricing (`quote()`), resource creation (`consume()`), and settlement callbacks (`onOrderSettled()`) to adapter contracts. |
| **Revenue Routing** | Settled orders route funds through RevenueRouter for cohort/position/treasury distribution. |
| **Dispute Integration** | Buyers can open disputes within the 3-day window; disputes are handled by CommerceDisputes. |
| **Per-Community Activation** | Communities must be explicitly activated on the marketplace. |
| **Cohort Tagging** | Offers can be tagged to route revenue to a specific cohort. |

#### Use Cases

1. **Service marketplace**: A community member offers tutoring services for 50 USDC; buyer purchases, seller marks fulfilled, and after 3 days the revenue is distributed.
2. **Cooperative store**: Members list handmade goods with 10% discount for community token payment.
3. **Housing reservations**: Sellers list housing units via HousingManager adapter; buyers book stays through the marketplace.
4. **Dispute protection**: Buyer receives defective goods, opens a dispute within 3 days, and CommerceDisputes routes the refund.

---

### 3.10 Commerce Dispute Resolution

**Contract**: `CommerceDisputes`

#### Features

| Feature | Description |
|---|---|
| **Dispute Types** | MARKETPLACE_ORDER and HOUSING_RESERVATION (extensible). |
| **Outcomes** | REFUND_BUYER or PAY_SELLER (future: SPLIT, CUSTOM for partial outcomes). |
| **Lifecycle** | OPEN → RESOLVED / CANCELLED. |
| **Duplicate Prevention** | Only one active dispute per (type, relatedId) pair. |
| **Evidence URI** | IPFS or similar reference attached to each dispute. |
| **Callback System** | On resolution, calls `IDisputeReceiver.onDisputeResolved()` on the Marketplace to execute economic outcomes. |
| **Admin Finalization** | MVP: admin-only dispute resolution (planned: verifier/juror integration). |

#### Use Cases

1. **Defective product refund**: Buyer opens dispute → admin reviews evidence → resolves as REFUND_BUYER → Marketplace automatically refunds the buyer.
2. **Host-guest conflict**: Housing reservation dispute → admin decides PAY_SELLER → Marketplace routes funds to seller via RevenueRouter.
3. **Cancelled dispute**: Parties reach agreement off-chain → governance cancels the dispute.

---

### 3.11 Co-Housing Manager

**Contract**: `HousingManager`

#### Features

| Feature | Description |
|---|---|
| **Unit Management** | Create housing units with pricing, capacity, metadata, and custom cancellation policies. ERC-1155 token minted per unit (ownership proof). |
| **Investor Staking** | Investors stake USDC to back units (quality assurance and community investment). |
| **Reservation Lifecycle** | PENDING → CHECKED_IN → CHECKED_OUT (or CANCELLED / REFUNDED). |
| **Availability Tracking** | Day-level occupancy tracking prevents double-booking. |
| **IModuleProduct Implementation** | Integrates with Marketplace via `quote()`, `consume()`, `onOrderSettled()`. |
| **Cancellation Policies** | Default tiered refunds (>7 days = 100%, 3–7 days = 50%, <3 days = 0%) or custom per-unit policy. |
| **Check-In/Check-Out** | Only guest can check in (on/after check-in date) and check out (after checking in). |
| **Minimum Stay** | Enforces minimum 1-night stay. |

#### Use Cases

1. **Community housing cooperative**: Members list available rooms; guests book via Marketplace; investors stake USDC to back quality.
2. **Short-term rentals**: Owner lists a unit at $80/night with custom 50% cancellation refund; guest books 5 nights, checks in, checks out.
3. **Dispute-triggered refund**: Guest's reservation is refunded via dispute — dates are automatically freed for re-booking.

---

### 3.12 Request Hub (Community Forum)

**Contract**: `RequestHub`

#### Features

| Feature | Description |
|---|---|
| **Request Creation** | Community members post requests (needs, ideas, proposals) with title, IPFS content, and tags. |
| **Threaded Comments** | Nested comment system with parent-child relationships and IPFS content. |
| **Moderation** | Moderators can freeze/archive requests and hide/unhide comments. |
| **Bounties** | Requests can have ERC-20 bounties funded by community members (funds held in community treasury vault). |
| **ValuableAction Linking** | Requests can be linked to a ValuableAction (one-shot engagement) for formal work verification. |
| **Winner Approval & Completion** | Moderators approve a winner → winner calls `completeEngagement()` → WORK SBT minted + atomic on-chain bounty transfer from treasury vault to the winner. |
| **Rate Limiting** | Max 10 posts/day per user with 1-minute minimum between posts. |
| **Tag-Based Filtering** | On-chain tag-based request filtering (with recommendation for off-chain indexing). |

#### Use Cases

1. **Community bounty board**: "Fix the community center roof" request with 500 USDC bounty → a contractor completes the work → moderator approves → WORK SBT + atomic on-chain bounty transfer.
2. **Idea incubation**: Members discuss community improvement ideas; popular ones get linked to ValuableActions for formal execution.
3. **Moderation**: Inappropriate comments are hidden by moderators; spam requests are frozen.

---

### 3.13 Drafts Manager (Collaborative Proposals)

**Contract**: `DraftsManager`

#### Features

| Feature | Description |
|---|---|
| **Collaborative Drafting** | Multiple contributors develop governance proposals together with version history (IPFS snapshots). |
| **Review System** | Community members review drafts (SUPPORT, OPPOSE, NEUTRAL, REQUEST_CHANGES) with IPFS-linked feedback. |
| **Peer Review Thresholds** | Minimum review count, minimum review period (3 days default), and support threshold (60% default) required before escalation. |
| **Governance Escalation** | Finalized drafts can be escalated to the Governor as standard or multi-choice proposals. |
| **Lifecycle Tracking** | DRAFTING → REVIEW → FINALIZED → ESCALATED → WON/LOST. |
| **Review Retraction** | Reviewers can retract their reviews during the review phase. |
| **Cross-Module Links** | Drafts can optionally reference a source request from RequestHub. |
| **Configurable Thresholds** | Review period, minimum reviews, and support threshold are governance-configurable. |

#### Use Cases

1. **Policy development**: Three community members collaborate on a budget proposal, creating 4 version snapshots → submitted for review → 5 reviews with 80% support → finalized → escalated as multi-choice governance proposal.
2. **Request-to-proposal pipeline**: A popular RequestHub idea is developed into a formal draft, reviewed, and escalated to governance.
3. **Iterative improvement**: After receiving "REQUEST_CHANGES" reviews, authors update the draft, create a new version snapshot, and resubmit.

---

### 3.14 Treasury Adapter

**Contract**: `TreasuryAdapter`

#### Features

| Feature | Description |
|---|---|
| **Policy Engine** | Configurable allowlists for tokens, destinations, and vault adapters per community. |
| **Spending Caps** | Per-token basis-point cap on single-transaction spending relative to treasury balance. |
| **Safe Transaction Builder** | Generates Safe-compatible calldata for ERC-20 transfers, bounty setup, vault deposits, and vault withdrawals. |
| **No Fund Custody** | TreasuryAdapter never holds funds — it only validates and builds transaction payloads. |
| **Spend Validation** | `validateSpend()` checks token allowlist, destination allowlist, and cap compliance before building transactions. |
| **Vault Integration** | Supports deposit/withdraw to external investment vault adapters (e.g., yield vaults). |

#### Use Cases

1. **Governance-controlled spending**: Timelock executes a treasury transfer by calling `buildERC20TransferTx()` → Safe executes the returned calldata.
2. **Bounty funding**: Built-in transaction builder for setting bounties in RequestHub.
3. **Treasury yield**: Community governance deposits excess treasury funds into yield vaults via adapter.
4. **Spending guardrails**: Maximum 5% of treasury balance per transaction, only to whitelisted destinations.

---

### 3.15 Parameter Controller

**Contract**: `ParamController`

#### Features

| Feature | Description |
|---|---|
| **Community-Scoped Parameters** | Governance, eligibility, economic, cohort, and verifier parameters stored per community. |
| **Type-Safe Storage** | Separate mappings for uint256, bool, and address[] parameters. |
| **Fee Scheduling** | Time-based fee periods with start/end/bps for dynamic fee transitions. |
| **Batch Parameter Setting** | Dedicated batch-setters for verifier params, governance params, eligibility params, revenue policy, and cohort params. |
| **Registry Bootstrap** | One-time wiring of CommunityRegistry; before timelock is set, community admins can configure parameters. |
| **Validation** | Minimum guarantees cannot exceed 100%, panel size/min consistency checks, etc. |

#### Managed Parameters

| Category | Parameters |
|---|---|
| **Governance** | DEBATE_WINDOW, VOTE_WINDOW, EXECUTION_DELAY |
| **Eligibility** | MIN_SENIORITY, MIN_SBTS, PROPOSAL_THRESHOLD |
| **Economic** | MIN_TREASURY_BPS, MIN_POSITIONS_BPS, SPILLOVER_TARGET, SPILLOVER_SPLIT_BPS_TREASURY, FEE_ON_WITHDRAW, BACKING_ASSETS |
| **Cohort** | MAX_INVESTOR_COHORTS_ACTIVE, COHORT_PRIORITY_SCHEME |
| **Verifier** | VERIFIER_PANEL_SIZE, VERIFIER_MIN, MAX_PANELS_PER_EPOCH, USE_VPT_WEIGHTING, MAX_WEIGHT_PER_VERIFIER, COOLDOWN_AFTER_FRAUD |

---

### 3.16 Token System

**Contracts**: `CommunityToken`, `MembershipTokenERC20Votes`, `VerifierPowerToken1155`

#### 3.16.1 CommunityToken (USDC-Backed Stablecoin)

| Feature | Description |
|---|---|
| **1:1 USDC Backing** | Mint by depositing USDC, redeem to withdraw USDC. Full collateralization enforced. |
| **Configurable Redemption Fee** | Fee BPS read from ParamController; sent to community treasury. |
| **Max Supply Cap** | Governance-configurable supply ceiling. |
| **Treasury Management** | Deposit USDC to strengthen reserves; withdraw excess (above backing ratio) for operations. |
| **Emergency Controls** | Pausable, 7-day delayed emergency withdrawals with admin approval. |
| **Backing Ratio Monitoring** | `getBackingRatio()` returns health of reserves (should be ≥ 100%). |

**Use Cases**: Community payments with price stability, marketplace denomination, worker salary calculations.

#### 3.16.2 MembershipToken (Governance Power)

| Feature | Description |
|---|---|
| **Earned Only** | Zero initial supply; tokens minted exclusively through verified ValuableAction completion. |
| **ERC20Votes** | Full OpenZeppelin governance integration (delegation, checkpoints, snapshots). |
| **Permit** | Gasless approvals via EIP-2612. |
| **100M Supply Cap** | Hard maximum to prevent inflation attacks. |
| **Batch Minting** | Efficient multi-recipient minting for founder bootstrap. |
| **Emergency Burn** | Governance can burn tokens in emergencies. |

**Use Cases**: Governance voting power, proposal threshold gating, community reputation proxy.

#### 3.16.3 VerifierPowerToken (VPT-1155)

| Feature | Description |
|---|---|
| **Per-Community Power** | tokenId = communityId; balance = verifier power. |
| **Non-Transferable** | Regular transfers disabled; only admin transfer by governance. |
| **Community Initialization** | Each community must be initialized before VPT can be issued. |
| **Batch Operations** | Batch mint/burn for efficient verifier set management. |

**Use Cases**: Weighted juror selection, verifier accountability, governance-controlled verifier elections.

---

### 3.17 Soulbound Token (SBT) System

**Contract**: `ValuableActionSBT`

#### Features

| Feature | Description |
|---|---|
| **5 Token Kinds** | WORK, ROLE, CREDENTIAL, POSITION, INVESTMENT — each with specialized data fields. |
| **Non-Transferable** | Soulbound: `approve()`, `setApprovalForAll()`, and transfers between non-zero addresses all revert. |
| **Rich Metadata** | Each token stores: kind, communityId, actionTypeId, roleTypeId, cohortId, points, weight, issuedAt, endedAt, expiry, closeOutcome, verifier. |
| **Position Lifecycle** | Positions can be closed with outcome stamps; role records minted from closed positions. |
| **Raw Metadata Storage** | Arbitrary bytes metadata stored alongside structured data. |
| **URI Support** | Optional tokenURI for off-chain metadata. |

#### Use Cases

1. **Immutable work history**: Every verified engagement creates a permanent WORK SBT — a decentralized resume.
2. **Active position tracking**: POSITION SBTs represent current roles; their points determine revenue share via RevenueRouter.
3. **Career records**: Closed positions mint ROLE SBTs preserving the tenure, dates, points, and outcome.
4. **Investment receipts**: INVESTMENT SBTs serve as immutable proof-of-investment with cohort association for claims.
5. **Verifiable credentials**: CREDENTIAL SBTs from CredentialManager prove course completion.

---

### 3.18 Project Factory

**Contract**: `ProjectFactory`

#### Features

| Feature | Description |
|---|---|
| **Minimal Project Registry** | Creates lightweight project records with creator address, IPFS content, and linked ERC-1155 token contract. |
| **Sequential IDs** | Auto-incrementing project IDs. |
| **Active Flag** | Projects track active status. |

#### Use Cases

1. **Community project tracking**: Register new community initiatives (housing projects, educational programs) with linked token contracts for project-specific assets.

---

## 4. Cross-Cutting Concerns

### Access Control

- **AccessManager**: All privileged operations use OpenZeppelin `AccessManaged`. A single `AccessManager` instance governs the entire system.
- **15 System Roles**: Defined in `Roles.sol` (uint64), covering revenue routing, investment recording, SBT management, token minting, commerce, housing, and verifier management.
- **3 Community Roles**: Governance, Moderator, Curator (bytes32), managed per-community in `CommunityRegistry`.
- **Bootstrap Path**: Before timelock is wired, community admins can configure parameters.

### Error Handling

- **Centralized Error Library**: `Errors.sol` defines 25+ custom errors covering authorization, governance, verification, tokens, and SBT operations.
- **Context-Rich Errors**: Errors include relevant parameters (e.g., `InsufficientVotingPower(voter, required, actual)`).

### Security Patterns

- **ReentrancyGuard**: Applied to token-handling flows (Marketplace, RevenueRouter, CommunityToken, RequestHub) and housing staking/unstaking paths in HousingManager.
- **SafeERC20**: All ERC-20 interactions use OpenZeppelin's SafeERC20 wrapper.
- **Pull-Over-Push**: RevenueRouter uses index-based pull patterns instead of push-on-receive.
- **Cooldown Periods**: Time-based restrictions on engagements, emergency withdrawals, and fee changes.
- **Soulbound Enforcement**: ValuableActionSBT and VerifierPowerToken1155 prevent unauthorized transfers.
- **Operational Monitoring**: D-1 backing-ratio checks (`scripts/check-balance.ts`) and D-2 engagement anomaly checks (`scripts/check-claim-status.ts`) with runbooks in `docs/EN/guides/`.

### Upgradability

- Contracts are **not upgradeable** (no proxy pattern). Module addresses can be swapped via CommunityRegistry, providing module-level replaceability without storage migration.

---

## 5. Design Notes (Clarified)

1. **RequestHub bounty payouts**: Atomic on-chain transfers are planned — `completeEngagement()` will transfer bounty tokens directly from the treasury vault to the winner in the same transaction.

2. **Engagement appeal resolution**: Appeal resolution will integrate with **Kleros** (or other decentralized arbitration protocols) for impartial, external jury adjudication. The existing `Appeal` struct provides the on-chain scaffolding for this integration.

3. **CohortRegistry revenue tracking**: `markRecovered()` is called by the **RevenueRouter** itself during distribution cycles, serving as a synchronized bookkeeping layer that tracks cumulative revenue routed to each cohort.
