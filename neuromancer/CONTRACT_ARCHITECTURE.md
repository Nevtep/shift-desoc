# Shift DeSoc · Comprehensive Smart Contract Architecture (EN)

This reference concentrates the essential technical context for every production contract in the Shift DeSoc stack. Use it when bootstrapping new tooling, writing agents, or auditing integrations so you no longer need to open twenty individual markdown files.

## Index

1. [Claims](#claims)
2. [CohortRegistry](#cohortregistry)
3. [CommunityRegistry](#communityregistry)
4. [CommunityToken](#communitytoken)
5. [CountingMultiChoice](#countingmultichoice)
6. [DraftsManager](#draftsmanager)
7. [HousingManager *(stub)*](#housingmanager-stub)
8. [Marketplace *(stub)*](#marketplace-stub)
9. [MembershipTokenERC20Votes](#membershiptokenerc20votes)
10. [ParamController](#paramcontroller)
11. [ProjectFactory](#projectfactory)
12. [RequestHub](#requesthub)
13. [RevenueRouter](#revenuerouter)
14. [ShiftGovernor](#shiftgovernor)
15. [TreasuryAdapter *(stub)*](#treasuryadapter-stub)
16. [ValuableActionRegistry](#valuableactionregistry)
17. [ValuableActionSBT](#valuableactionsbt)
18. [VerifierElection](#verifierelection)
19. [VerifierPowerToken1155](#verifierpowertoken1155)
20. [VerifierManager](#verifiermanager)

---

## Claims

**Purpose**: Central verification court. Handles claim submission, democratic juror selection (via VerifierManager), dual-layer vote privacy, reward minting, and appeals.

**Architecture Highlights**:
- Dual privacy: public aggregates (`approvalsCount`, `rejectionsCount`) plus private `hasVoted`/`votes` mappings for accountability.
- Lifecycle states: `Pending → Approved/Rejected → Revoked` with appeal hooks.
- Cooldowns, deadlines, concurrency limits per ValuableAction.

**Key Flows**:
- `submit` validates action, cooldown, concurrency, and stores IPFS evidence; optionally auto-calls `selectJurors`.
- `verify` records anonymous aggregates and per-juror votes; resolves once M-of-N satisfied, but currently penalizes late jurors (known issue).
- `_resolveClaim` mints MembershipToken, ValuableActionSBT, schedules cooldown, updates verifier performance via VerifierManager.
- `submitAppeal` re-triggers juror selection for revocable actions.

**Integrations**: ValuableActionRegistry (parameters), VerifierManager (jurors & reputation), ValuableActionSBT (soulbound mint), MembershipToken, RevenueRouter / CommunityToken (payments planned).

---

## CohortRegistry

**Purpose**: Tracks ROI-guaranteed investment cohorts per community for the cohort-based revenue waterfall.

**Architecture**:
- `Cohort` struct stores ROI target (bps), priority weight, invested/recovered totals, immutable `termsHash`.
- `addInvestment` callable only by ValuableActionSBT to sync investment SBT issuance.
- `markRecovered` callable only by RevenueRouter; auto-deactivates cohort when ROI target reached.

**Key Functions**: `createCohort`, `addInvestment`, `markRecovered`, `getCohortWeight`, `getActiveCohorts`, ROI progress helpers.

**Integrations**: RevenueRouter for distributions, ValuableActionSBT for investment logging, ParamController for per-community policy.

---

## CommunityRegistry

**Purpose**: Source of truth for community metadata, module addresses, roles, and federation links.

**Model**:
- `Community` struct: governance windows, eligibility thresholds, economic splits, module addresses (governor, timelock, requestHub, draftsManager, claims, verifier stack, valuableActionSBT, treasuryAdapter), parent/ally relations.
- Role hierarchy per community (admins, moderators, curators) enforced via AccessControl-style helpers.

**Key APIs**: `registerCommunity`, `updateParameters`, `setModuleAddress`, `grantCommunityRole`, `getCommunityModules`, `formAlliance` (planned), status toggles.

**Integrations**: RequestHub & DraftsManager for permissions, ParamController for downstream config, TreasuryAdapter for financial routing, cross-community federation logic.

---

## CommunityToken

**Purpose**: USDC-backed programmable currency for salaries and treasury operations, with optional redemption fee funding community operations.

**Architecture**:
- ERC20 + AccessControl + Pausable + ReentrancyGuard.
- Immutable USDC backing with `getBackingRatio`, `calculateRedemption`, `getAvailableTreasuryBalance` helpers.
- Roles: `MINTER_ROLE` (Claims/RevenueRouter), `TREASURY_ROLE`, `EMERGENCY_ROLE`, `DEFAULT_ADMIN_ROLE` (governance).
- Salary subsystem: `mintFromSalary`, `fundSalaryBudget`, `initializePeriod`, `claimSalary` using ValuableActionSBT snapshots.
- Emergency withdraw requires 7-day delay.

**Integrations**: RevenueRouter (mint for worker pool), Claims (pay workers), TreasuryAdapter (spend controls), bridges for cross-community transfers.

---

## CountingMultiChoice

**Purpose**: Vote-counting engine enabling weighted multi-option governance while maintaining backward compatibility with binary voting.

**Core Structures**:
- `ProposalVote`: tracks for/against/abstain plus `optionVotes`, `hasVoted`, `voterWeights`.
- `MultiChoiceConfig`: toggles multi-choice per proposal, defines option count, weight totals.

**Workflow**:
- `enableMulti` invoked by ShiftGovernor when proposals call `proposeMultiChoice`.
- `castVoteMulti` validates weight array (sums ≤ 1e18), records distribution, updates totals, emits `VoteMultiCast`.
- Query helpers: `getOptionVotes`, `getAllOptionVotes`, `getWinningOption`, `getVoterDistribution`.

**Security**: Double-voting prevention, weight validation, Governor-only config.

---

## DraftsManager

**Purpose**: Collaborative pipeline bridging RequestHub discussions and on-chain proposals, with versioning, reviews, and consensus gating.

**Architecture**:
- `Draft` struct with contributors set, `ActionBundle` (targets/values/calldatas/actionsHash), version history (IPFS CIDs), review state and linked proposalId.
- Status machine: Drafting → Review → Finalized → Escalated → Won/Lost.

**Key Ops**: `createDraft`, `addContributor`, `snapshotVersion`, `submitReview`, `finalizeForProposal`, `escalateToProposal` (binary or multi-choice), `updateProposalOutcome` (needs auth hardening).

**Known Gaps**: Community/request validation TODOs; admin functions lacking governance guards; events missing for some updates.

**Integrations**: RequestHub for contextual requests, ShiftGovernor for proposal creation, ValuableActionRegistry for bundling new action definitions.

---

## HousingManager *(stub)*

Placeholder for co-housing management: planned structs for `HousingUnit`, `Reservation`, pricing/priority rules, worker discounts, NFT reservations. Current contract only emits `UnitListed` and `Reserved` events; all logic TBD in Phase 2.

---

## Marketplace *(stub)*

Planned decentralized commerce engine. Future model includes `Product`, `Purchase`, fee routing, ValuableActionSBT-based seller tiers, ERC1155/721 escrow. Present implementation exposes `listSku` and `buy` events only; storage, payments, dispute logic pending.

---

## MembershipTokenERC20Votes

**Purpose**: Pure merit-based governance token. Sole mint path is verified work (Claims) or initial founder distribution (CommunityFactory). Hard supply cap: 100M tokens.

**Features**:
- ERC20 + ERC20Votes + ERC20Permit with AccessControl.
- `MINTER_ROLE` limited to Claims & CommunityFactory; `GOVERNANCE_ROLE` for emergency burns and role management.
- Delegation (including signature-based), vote snapshots for Governor integration.
- Batch mint for efficiency.

**Integrations**: ShiftGovernor (voting power), Claims (reward mint), TreasuryAdapter (role-gated spending), CommunityFactory (bootstrap).

---

## ParamController

**Purpose**: Governance-managed parameter store for timing, eligibility, and economic policies.

**Structures**: `GovernanceParams`, `EligibilityParams`, `EconomicParams`, plus `ParameterUpdate` queue with timelock-style `effectiveTime`.

**Capabilities**:
- `proposeParameterUpdate` with authority checks, `executeParameterUpdate` after delay, emergency reset.
- Getters for voting window, threshold, revenue splits, eligibility checks (seniority, ValuableActionSBT count, MembershipToken balance).
- Supports future scheduling and templates.

**Integrations**: ShiftGovernor (timings/quorum), Claims & VerifierManager (eligibility, juror config), RevenueRouter (splits, spillover policy).

---

## ProjectFactory

**Purpose**: Registry for community projects and ERC1155 crowdfunding tokens; base for milestone funding.

**Current State**:
- `Project` struct storing creator, metadata CID, associated ERC1155 token, active flag.
- `create` assigns sequential IDs; advanced milestone/crowdfunding features planned.

**Future Hooks**: Milestone validation, investor protections, revenue sharing, ValuableAction-driven work linkage.

---

## RequestHub

**Purpose**: On-chain forum enabling community discussions, moderation, bounties, and ValuableAction linking.

**Structures**: `Request` (metadata, status, tags, bounty, linked ValuableAction) and threaded `Comment` with parent IDs.

**Controls**:
- Rate-limiting per user/community (≤10 posts/day, ≥60 seconds between posts, first-post exception).
- Status transitions (OPEN_DEBATE/FROZEN/ARCHIVED) via community moderators.
- `addBounty` (token transfer TBD), `linkValuableAction` gating to author/admin.

**Integrations**: CommunityRegistry roles, DraftsManager for pipeline, Claims for bounty claims, future treasury payments.

---

## RevenueRouter

**Purpose**: Cohort-based waterfall distributor ensuring workers’ minimum, treasury base, and investor ROI guarantees.

**Flow**:
1. Read policy from ParamController: `minWorkersBps`, `treasuryBps`, `investorsBps`, spillover target.
2. Allocate to worker pool, treasury reserves, investor pool.
3. `_distributeToActiveCohorts` weights cohorts by unrecovered amount × priority weight; mark recovered via CohortRegistry.
4. `_distributeToCohortInvestors` pro-rata across cohort investors.
5. Spillover (if no cohorts / rounding) routes per policy.

**State**: Tracks `workerPools`, `treasuryReserves`, `workerClaims`, `investorClaims` per community/token.

**Roles**: `DISTRIBUTOR_ROLE`, `TREASURY_ROLE`, `DEFAULT_ADMIN_ROLE` (controllers only).

**Tools**: Preview helpers for UIs, supported token gating, multi-token isolation.

---

## ShiftGovernor

**Purpose**: OpenZeppelin Governor derivative providing both binary and multi-choice voting with timelock execution.

**Highlights**:
- `proposeMultiChoice` extends base propose, registers option count, enables CountingMultiChoice.
- `castVoteMultiChoice` fetches vote weight via MembershipToken snapshots and forwards to counting contract.
- Constructor config: 1-day delay, 5-day voting, 4% quorum, timelock executor.
- Events for multi-choice proposals/votes, `setCountingMulti` governance-only; `initCountingMulti` one-time setup.

**Security**: inherits OZ guard rails (quorum, thresholds, snapshotting, timelock). Custom errors for invalid state, insufficient power, etc.

---

## TreasuryAdapter *(stub)*

Future Safe/Zodiac bridge. Current `execute` always reverts with `NotConfigured()`. Planned design includes queued `TreasuryOperation`, Safe integration, governance-controlled spending, emergency pause.

---

## ValuableActionRegistry

**Purpose**: Defines what work counts, its verification parameters, and reward mix for MembershipToken, CommunityToken, and Investment SBTs.

**Struct**: `ValuableAction` with rewards, juror requirements, verifier incentive config, evidence specs, title template, cooldowns, concurrency limits, governance requirements, founder bootstrap flags.

**Workflows**:
- `proposeValuableAction` (with founder/governance activation paths), `update`, `deactivate`, `activateFromGovernance`.
- Founder whitelist for safe bootstrap; governance moderators manage updates.

**Integrations**: Claims (per-claim config), ValuableActionSBT (point awards), MembershipToken, CohortRegistry (investment actions), ParamController (threshold references).

---

## ValuableActionSBT

**Purpose**: Soulbound worker reputation token with decaying WorkerPoints and achievements. Previously named WorkerSBT, renamed to align with ValuableAction ecosystem terminology.

**Mechanics**:
- ERC721 non-transferable (overrides `_update`, `approve`, `setApprovalForAll`).
- Points mappings (`workerPoints`, `lifetimeWorkerPoints`, `lastWorkerPointsUpdate`), weekly exponential decay (default 95% retention) adjustable by governance.
- `mintAndAwardPoints` minted by Claims (MANAGER_ROLE) after verification; auto-mints SBT if absent.
- Achievements (default five tiers) unlocked by WorkerPoints thresholds; metadata stored on IPFS.
- Governance can `revokeSBT`, adjust decay rate, add achievements.

**Usage**: Eligibility checks, salary weighting, housing/marketplace priority rules (future), moderation permissions.

---

## VerifierElection

**Purpose**: Timelock-controlled verifier roster and power distribution manager, replacing staking with democratic appointments.

**Features**:
- `VerifierSet` per community storing array of verifiers, per-address power, `totalPower`, `lastReasonCID`.
- Only timelock (governance) can `setVerifierSet`, `adjustVerifierPower`, `banVerifiers`, `unbanVerifier`.
- Writes to VerifierPowerToken1155 for mint/burn operations with reason CID logging.
- Tracks bans with timestamps to support cooldown decisions.

**Integrations**: VerifierPowerToken1155 (power tokens), VerifierManager (eligibility data), Claims (disciplinary triggers), ParamController for configuration references.

---

## VerifierPowerToken1155

**Purpose**: ERC-1155 token representing per-community verifier power. Non-transferable; only timelock may mint/burn/admin-transfer.

**Key Points**:
- Token ID = communityId; `communityInitialized` gating ensures explicit enablement.
- `mint`/`burn`/`batchMint`/`batchBurn` require reason CIDs for transparency.
- Transfers disabled (reverts) to prevent trading of social authority; `adminTransfer` exists for governance-led migrations.
- `totalSupply` per community for analytics.

**Integrations**: VerifierElection (power orchestration), VerifierManager (auth checks), Claims (verifier eligibility), analytics dashboards.

---

## VerifierManager

**Purpose**: Executes juror selection (uniform or power-weighted) and fraud reporting, tying ParamController policies to VerifierElection data.

**Architecture**:
- `JurorSelection` stored per claim (selected addresses, powers, seed, timestamp, completion flag).
- Holds immutable references to VerifierElection, ParamController, governance; `claimsContract` settable by governance.

**Key Ops**:
- `selectJurors(claimId, communityId, seed)` reads community parameters (`USE_VPT_WEIGHTING`, `MAX_WEIGHT_PER_VERIFIER`, `VERIFIER_PANEL_SIZE`, `VERIFIER_MIN`), fetches eligible verifiers, applies bans and caps, performs deterministic selection (uniform or weighted), stores result.
- `reportFraud(claimId, communityId, offenders, evidenceCID)` ensures offenders were selected jurors, logs evidence, and emits for governance action.

**Protections**: prevents reselection per claim, enforces sufficient pool size, evidence required for fraud reports, only Claims contract may call selection/reporting.

---

*Document status: December 2025. Mirrors individual contract docs but expands narrative for faster cross-referencing.*
