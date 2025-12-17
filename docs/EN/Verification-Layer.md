# Verification & Reputation Layer

## 1. Overview

The Verification & Reputation Layer transforms off-chain work into verifiable on-chain outcomes that communities can trust. It defines valuable work archetypes, routes individual claims through a governed verification pipeline, and anchors the results as both token rewards and non-transferable credentials.

- **ValuableActionRegistry** catalogs every valuable action a community recognizes, including required evidence, juror configuration, and reward schedules.
- **Claims** manages the end-to-end workflow for work submissions, coordinating evidence intake, verifier coordination, resolution, and appeals.
- **VerifierPowerToken1155**, **VerifierElection**, and **VerifierManager** collectively implement the Verifier Power System (VPS), a governance-controlled alternative to economic staking that selects, weights, and supervises verifiers.
- **ValuableActionSBT** issues soulbound credentials that memorialize verified contributions and feed broader reputation systems.

Because this layer feeds governance power, treasury flows, and access control, it must remain deterministic, permissioned through community governance, and resilient against collusion, spam, and verifier misconduct.

## 2. Components

### 2.1 ValuableActionRegistry

- **Purpose**: Canonical registry of all valuable actions defined by a community, including verification parameters and incentive schedules.
- **Responsibilities**:
  - Store Valuable Action records with community scope, evidence requirements, juror counts (M-of-N), cooldowns, and reward weights across MembershipToken, CommunityToken, and InvestorSBT.
  - Emit stable IDs/events so downstream modules (Claims, UI, analytics) can reference the same action definition.
  - Handle activation and deactivation via governance: bootstrap founders can enable limited actions, full governance must approve ongoing changes.
  - Support updates or revocations where allowed, while recording IPFS reason hashes for transparency.
- **Interactions**: Claims reads action configs to validate submissions; ValuableActionSBT references the registry when minting credentials; governance uses registry APIs to stage new action definitions.

### 2.2 Claims

- **Purpose**: Represent and adjudicate claims that specific valuable actions occurred.
- **Responsibilities**:
  - Accept claims tied to a valuable action ID, with evidence CIDs, claimant identity, community ID, and deadlines derived from registry parameters.
  - Enforce per-action cooldowns, maximum concurrent claims, and verification windows.
  - Coordinate juror assignment via VerifierManager and track voting using dual-layer privacy (public aggregates + internal per-juror votes).
  - Resolve outcomes (Approved, Rejected, Revoked) and trigger downstream effects: reward minting, cooldown updates, SBT issuance, verifier reputation updates.
  - Manage appeals for actions marked revocable, with fresh juror panels and configurable thresholds.
- **Authorization**: Any eligible worker can submit claims; only assigned jurors may vote; only governance can revoke approved claims where allowed.

### 2.3 VerifierPowerToken1155

- **Purpose**: Non-transferable ERC-1155 token encoding verifier power per community, controlled exclusively by the timelock.
- **Responsibilities**:
  - Maintain balances where token ID = community ID; balance magnitude encodes verifier weight.
  - Allow governance to mint, burn, or administratively transfer power with IPFS-logged reasoning; reject public transfers to prevent trading.
  - Track total power per community for analytics and selection weighting.
- **Constraints**: Transfers disabled; only timelock role can mutate balances; communities must be initialized before power is granted.

### 2.4 VerifierElection

- **Purpose**: Governance-managed subsystem for selecting, configuring, and disciplining verifier sets.
- **Responsibilities**:
  - Maintain per-community verifier rosters, weights, and ban lists; synchronize changes by minting/burning VerifierPowerToken1155 balances.
  - Provide APIs for eligible verifier lists, power totals, and status checks consumed by VerifierManager.
  - Execute bans/unbans, bulk set updates, and incremental power adjustments with reason CIDs to enforce accountability.
- **Governance Link**: All state changes require timelock execution, ensuring community consensus before verifier rosters change.

### 2.5 VerifierManager

- **Purpose**: Operate the configurable M-of-N juror selection engine and fraud reporting channel.
- **Responsibilities**:
  - Read ParamController settings (panel size, minimum approvals, weighting mode, power caps) to customize selection per community.
  - Fetch eligible verifiers and power weights from VerifierElection; apply ban filters and weighting logic to choose panels.
  - Persist selection metadata for each claim (jurors, powers, seed, timestamps) so results can be audited and fraud reports validated.
  - Accept fraud reports from Claims, verifying that reported verifiers participated and emitting events for governance follow-up.
- **Access Control**: Only the Claims contract may request selections or file fraud reports; governance can update the authorized Claims address.

### 2.6 ValuableActionSBT

- **Purpose**: Soulbound token and WorkerPoints ledger capturing the outcome of verified valuable actions.
- **Responsibilities**:
  - Mint one SBT per worker (if absent) when Claims reports an approved action; award WorkerPoints reflecting action weight after applying time-based decay.
  - Track lifetime points, current decayed points, and unlocked achievements; expose getters for other modules to gate privileges.
  - Allow governance to adjust decay rate, define new achievements, or revoke SBTs in cases of fraud or misconduct.
- **Properties**: Non-transferable (transfer/approval functions revert); metadata stored off-chain via token URI; WorkerPoints decay weekly to favor active contributors.

## 3. Data Structures & State

- **ValuableActionRegistry**:
  - `ValuableAction`: community ID, reward weights, jurorsMin/panelSize, verify window, cooldown, max concurrent claims, revocability, governance requirements, evidence specification CID, title template, bootstrap flags.
  - Indexes: action ID → ValuableAction, community → action IDs, pending actions → proposal IDs, founder whitelist mappings.
- **Claims**:
  - `Claim`: valuable action ID, community ID, worker, evidence CID, status, approvals/rejections counts, verify deadline, juror list, hasVoted/votes mappings, appeal metadata.
  - Indexes: worker → claim IDs, community/action → pending claims, juror participation records for reputation updates.
- **VerifierPowerToken1155**:
  - Token ID = community ID; store totalSupply per community, initialization flags, and mapping of verifier address → balance.
- **VerifierElection**:
  - `VerifierSet`: array of verifiers, mapping to power weights, total power, timestamps, reason CIDs; banned verifier mappings with timestamps.
- **VerifierManager**:
  - `JurorSelection`: selected jurors, their powers, selection seed, timestamp, completion flag; mapping claim ID → selection.
  - Fraud report logs referencing offenders and evidence CIDs.
- **ValuableActionSBT**:
  - Worker → token ID, current points, lifetime points, last update timestamp; achievement definitions and per-worker unlock tracking; decay parameters.

## 4. Core Flows

### 4.1 Valuable Action Lifecycle

1. **Definition**: Community submits a ValuableAction proposal (via governance draft); upon approval and timelock execution, ValuableActionRegistry records the action as active (or founders bootstrap limited actions without governance where permitted).
2. **Publication**: Registry emits events so UIs and off-chain services list available actions with requirements and rewards.
3. **Claim Initiation**: Worker submits claim referencing action ID through Claims; registry parameters are fetched to validate eligibility and set deadlines.
4. **Verification Outcome**: After juror resolution (see 4.2), Claims finalizes the action as approved or rejected; the registry remains source of truth for parameters and revocability.
5. **Credentialing**: On approval, ValuableActionSBT mints/updates the worker’s SBT while Claims triggers governance/economic rewards tied to the action definition.

### 4.2 Verification & Disputes

1. **Juror Selection**: Claims calls VerifierManager with claim ID, community ID, and randomness seed; VerifierManager pulls eligible verifiers from VerifierElection and ParamController settings to assemble the panel.
2. **Voting**: Assigned jurors cast approval/rejection votes via Claims; aggregate counts are public while individual votes remain internal for reputation analysis.
3. **Resolution**: When approvals or rejections reach the configured threshold (M-of-N) or verification window expires, Claims sets final status. Approved claims trigger rewards, cooldowns, and SBT minting; rejected claims may allow appeals if action marked revocable.
4. **Appeals**: Workers can appeal rejected claims for revocable actions; Claims orchestrates a fresh juror panel and higher scrutiny thresholds before finalizing appeal outcome.
5. **Dispute Logging**: Any detected misconduct (e.g., inconsistent juror behavior) is reported to VerifierManager, which records fraud reports for governance review.

### 4.3 Verifier Lifecycle & Power

1. **Onboarding**: Governance uses VerifierElection to set the initial verifier set, minting VerifierPowerToken1155 balances for selected addresses.
2. **Selection Participation**: VerifierManager considers only verifiers with positive power and not banned; weighting may be uniform or power-proportional based on ParamController settings.
3. **Performance Feedback**: After each claim finalization, Claims informs VerifierManager of juror accuracy; communities can later adjust power via VerifierElection or automate based on performance metrics.
4. **Adjustments**: Governance proposals can mint/burn or transfer verifier power, ban/unban verifiers, or reconfigure panel sizes and thresholds through ParamController to keep verification quality aligned with community expectations.

### 4.4 Fraud & Misconduct Handling

- **Fraudulent Claims**: Governance may revoke approved actions (if `revocable = true`) via Claims, burn associated SBTs, and claw back rewards where downstream modules support it.
- **Verifier Misconduct**: VerifierManager’s fraud reports provide evidence for governance; VerifierElection can ban offenders and burn their power, while ParamController may adjust selection rules to mitigate systemic abuse.
- **SBT Revocation**: Governance calls ValuableActionSBT to revoke tokens for workers engaged in misconduct, resetting reputation while preserving lifetime history for audit trails.

## 5. Security & Invariants

- **Access Control**:
  - ValuableActionRegistry mutations require governance or designated moderators; founder shortcuts are limited to bootstrap periods.
  - Claims only accepts juror votes from assigned verifiers; appeals restricted to the original claimant; revocations limited to governance.
  - VerifierPowerToken1155 operations (mint/burn/admin transfer) restricted to timelock role; transfers disabled for everyone else.
  - VerifierElection functions gated by timelock; VerifierManager callable only by authorized Claims contract; ValuableActionSBT minting restricted to Claims (manager role) and revocation to governance role.
- **Data Integrity**:
  - Every claim links to an active Valuable Action and valid community; M ≤ N ensures reachable quorum.
  - Each ValuableActionSBT corresponds to exactly one worker and verified action history; achievments unlocked only once per worker.
  - Verifier power balances always reflect governance-approved state; total community power stays synchronized between VerifierElection and VPT.
  - Finalized claims are immutable unless governance executes explicit revocation flows.
- **Economic/Game-Theoretic Considerations**:
  - Eliminates pay-to-play by granting verifier power through governance rather than staking; reduces bribery risk but requires social accountability.
  - Weighted selection plus reputation updates incentivize accurate decisions; cooldowns and max concurrent limits deter spam claims.
  - Appeals and fraud reports provide recourse against collusion; timelock delays allow communities to react before misconduct propagates.
- **Abuse Mitigations**:
  - Claims enforce cooldowns, verification deadlines, and rate limits per action; governance can deactivate problematic actions rapidly.
  - Fraud reporting and ban lists prevent repeat offenders from participating until governance reinstates them.

## 6. Integration Points

| External Layer | Interaction | Key Touchpoints | Notes |
|----------------|-------------|-----------------|-------|
| Coordination Layer | Community context, discussion, parameter sourcing | Claims validates communities via CommunityRegistry; valuable actions often originate from RequestHub/DraftsManager; ParamController supplies verification thresholds | Communities must be registered and active before claims proceed |
| Governance Core | Authoritative control over registries and verifier power | Governor/Timelock executes ValuableAction updates, verifier set changes, parameter adjustments, SBT revocations | Timelock delay ensures review before verifier roster changes |
| Economic & Revenue Layer | Reward distribution after verification | Claims mints MembershipToken rewards, updates CommunityToken salary basis, triggers InvestorSBT when defined | Rewards only triggered for approved claims |
| Marketplace / Housing / Modules | Reputation-based access and benefits | Modules query ValuableActionSBT WorkerPoints/achievements or registry status to authorize perks or discounts | Must handle SBT revocations gracefully |
| Analytics & Frontends | Monitoring and transparency | Events emitted from all contracts (e.g., ValuableActionCreated, ClaimSubmitted, JurorsAssigned, SBTMinted) | Off-chain services reconstruct full history for accountability |

## 7. Testing Considerations

- **ValuableActionRegistry**:
  - Validate parameter bounds, activation paths, and deactivation flows; ensure revenue splits and juror configs obey invariants; confirm governance-only access.
- **Claims**:
  - Cover claim submission validation, juror voting paths, early resolution, timeout handling, cooldown enforcement, appeal flows, and governance revocations; test dual-layer vote tracking for privacy and reputation updates.
- **VerifierPowerToken1155**:
  - Ensure only timelock can mint/burn/admin transfer; verify transfer attempts revert; confirm totalSupply tracking and community initialization guards.
- **VerifierElection**:
  - Test full-set replacements, incremental adjustments, ban/unban cycles, and synchronization with VPT balances; include edge cases (empty candidate set, zero weights, duplicate verifiers).
- **VerifierManager**:
  - Exercise uniform vs weighted selection, power caps, insufficient verifier scenarios, fraud reporting authorization, and parameter updates via ParamController; verify deterministic selection given seed.
- **ValuableActionSBT**:
  - Test one-SBT-per-worker rule, point decay, achievement unlocking, governance revocation, and metadata updates; ensure non-transferability holds under all ERC721 entry points.
- **Integration / End-to-End**:
  - Scenario: define valuable action → submit claim → select jurors → reach quorum → finalize claim → mint tokens/SBT → update verifier reputation.
  - Negative cases: spam claims blocked by cooldown, juror fraud leading to bans, governance revoking an action and burning SBT.
- **Fuzz/Property Testing**:
  - Random claim bursts to validate cooldowns and rate limits; randomized verifier elections to ensure VPT totals stay consistent; parameter mutation sequences to confirm invariants (e.g., M ≤ N, revenue splits sum to 10,000).

---

The Verification & Reputation Layer provides a governed, auditable pathway from community-defined work to on-chain recognition, combining configurable verification logic with governance-controlled verifier power and durable reputation credentials. It underpins Shift’s merit-based governance by ensuring every token and credential originates from verified, community-approved contributions.
