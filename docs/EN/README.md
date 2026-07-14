# Shift DeSoc Documentation Hub

**Welcome to Shift DeSoc documentation.** This hub provides complete technical and business documentation for Shift as self-hostable DAO infrastructure.

The canonical product is the contract system itself. The web admin and indexer stacks are reference tooling that make operations easier, but communities can deploy the contracts and build or host their own tooling without depending on Shift-run services.

## 🎯 Quick Navigation

| Document | Purpose |
|----------|---------|
| [**Whitepaper**](./Whitepaper.md) | Vision, business model, and investment case |
| [**Architecture**](./Architecture.md) | System design and 24-contract component relationships |
| [**Layers**](./Layers.md) | Unified 5-layer architecture reference |
| [**Tokenomics**](./Tokenomics.md) | Token economics, revenue distribution, and cohorts |
| [**Contracts**](./contracts/) | Individual contract documentation (24 contracts) |
| [**Guides**](./guides/) | Operational guides for community management |

---

## 📚 Documentation Structure

### Core Documents

| Document | Description |
|----------|-------------|
| [Whitepaper.md](./Whitepaper.md) | Executive vision, business model, market opportunity, investment case |
| [Architecture.md](./Architecture.md) | System design, 5-layer architecture, component relationships, security model |
| [Layers.md](./Layers.md) | Unified layer reference merging coordination, governance, verification, economic, commerce |
| [Tokenomics.md](./Tokenomics.md) | MembershipToken, CommunityToken, ValuableActionSBT (5 types), revenue waterfall, cohorts |

### Contract Documentation (24 Contracts)

#### Layer 1: Community Coordination (4 contracts)
- [CommunityRegistry.md](./contracts/CommunityRegistry.md) — Community metadata and module coordination
- [RequestHub.md](./contracts/RequestHub.md) — Discussion forum and idea coordination
- [DraftsManager.md](./contracts/DraftsManager.md) — Collaborative proposal development
- [ParamController.md](./contracts/ParamController.md) — Dynamic parameter management

#### Layer 2: Democratic Governance (4 contracts)
- [ShiftGovernor.md](./contracts/ShiftGovernor.md) — Multi-choice governance engine
- [CountingMultiChoice.md](./contracts/CountingMultiChoice.md) — Weighted voting mechanism
- [MembershipTokenERC20Votes.md](./contracts/MembershipTokenERC20Votes.md) — Merit-based governance tokens
- TimelockController (OpenZeppelin) — Execution delays and protection

#### Layer 3: Work Verification (9 contracts)
- [ValuableActionRegistry.md](./contracts/ValuableActionRegistry.md) — Community-defined engagement types
- [Engagements.md](./contracts/Engagements.md) — One-shot work verification workflow
- [VerifierPowerToken1155.md](./contracts/VerifierPowerToken1155.md) — Democratic verifier selection
- [VerifierElection.md](./contracts/VerifierElection.md) — Verifier governance and elections
- [VerifierManager.md](./contracts/VerifierManager.md) — M-of-N juror selection
- [ValuableActionSBT.md](./contracts/ValuableActionSBT.md) — Multi-type Soulbound tokens (5 types)
- [CredentialManager.md](./contracts/CredentialManager.md) — Course credentials issuance
- [PositionManager.md](./contracts/PositionManager.md) — Ongoing position lifecycle
- [InvestmentCohortManager.md](./contracts/InvestmentCohortManager.md) — Investment cohort coordination

#### Layer 4: Economic Engine (4 contracts)
- [CommunityToken.md](./contracts/CommunityToken.md) — 1:1 USDC-backed community currency
- [CohortRegistry.md](./contracts/CohortRegistry.md) — Investment cohort storage and tracking
- [RevenueRouter.md](./contracts/RevenueRouter.md) — Automated revenue distribution waterfall
- [TreasuryAdapter.md](./contracts/TreasuryAdapter.md) — Treasury spending controls and guardrails

#### Layer 5: Community Modules (3 contracts)
- [Marketplace.md](./contracts/Marketplace.md) — Decentralized service marketplace
- [CommerceDisputes.md](./contracts/CommerceDisputes.md) — Commercial dispute resolution
- [HousingManager.md](./contracts/HousingManager.md) — Co-housing coordination

### Guides

| Guide | Purpose |
|-------|---------|
| [Community Admin CLI](./guides/COMMUNITY_ADMIN_CLI.md) | CLI operations for community administrators |
| [Management Tools](./guides/MANAGEMENT_TOOLS.md) | System management scripts and utilities |

---

## 🗺️ Documentation by Use Case

### Understanding the System
1. **Start**: [Architecture.md](./Architecture.md) — System overview
2. **Deep dive**: [Layers.md](./Layers.md) — Layer-by-layer reference
3. **Economics**: [Tokenomics.md](./Tokenomics.md) — Token and revenue mechanics
4. **Business**: [Whitepaper.md](./Whitepaper.md) — Vision and investment case

### Source of Truth
- On-chain state and event logs are canonical.
- Indexers and admin UIs are convenience layers for querying and operating that state.
- Communities may self-host alternative indexers, frontends, or CLI workflows without changing the protocol model.

### Implementing Governance
1. [ShiftGovernor.md](./contracts/ShiftGovernor.md) — Core governance engine
2. [CountingMultiChoice.md](./contracts/CountingMultiChoice.md) — Voting mechanism
3. [MembershipTokenERC20Votes.md](./contracts/MembershipTokenERC20Votes.md) — Governance tokens

### Building Work Verification
1. [ValuableActionRegistry.md](./contracts/ValuableActionRegistry.md) — Work type definitions
2. [Engagements.md](./contracts/Engagements.md) — One-shot verification workflow
3. [VerifierManager.md](./contracts/VerifierManager.md) — Juror selection
4. [ValuableActionSBT.md](./contracts/ValuableActionSBT.md) — SBT issuance (5 types)

### Managing Credentials & Positions
1. [CredentialManager.md](./contracts/CredentialManager.md) — Course credential flow
2. [PositionManager.md](./contracts/PositionManager.md) — Ongoing position lifecycle
3. [InvestmentCohortManager.md](./contracts/InvestmentCohortManager.md) — Investment coordination

### Setting Up Revenue Distribution
1. [Tokenomics.md](./Tokenomics.md) — Revenue waterfall explanation
2. [RevenueRouter.md](./contracts/RevenueRouter.md) — Distribution implementation
3. [CohortRegistry.md](./contracts/CohortRegistry.md) — Cohort tracking

---

## 📊 Current Status (January 2026)

**🚧 Early Beta (Base Sepolia Testnet)**
- 24 contracts deployed on Base Sepolia testnet (Community ID 1 operational)
- API-based deployment system (~$0.19 per community on testnet)
- Full documentation coverage in EN/ES (Architecture, Layers, Tokenomics, 24 contracts)
- Mainnet readiness: in progress; no mainnet deployment yet

### Contract Suite (24 contracts)

| Layer | Contracts |
|-------|-----------|
| **Coordination** | CommunityRegistry, RequestHub, DraftsManager, ParamController |
| **Governance** | ShiftGovernor, CountingMultiChoice, MembershipTokenERC20Votes, TimelockController |
| **Verification** | ValuableActionRegistry, Engagements, VerifierPowerToken1155, VerifierElection, VerifierManager, ValuableActionSBT, CredentialManager, PositionManager, InvestmentCohortManager |
| **Economic** | CommunityToken, CohortRegistry, RevenueRouter, TreasuryAdapter |
| **Commerce** | Marketplace, CommerceDisputes, HousingManager |

### SBT Types (via ValuableActionSBT)

| Type | Issued By | Purpose |
|------|-----------|---------|
| WORK | Engagements | Completed one-shot contributions |
| ROLE | PositionManager | Successfully completed positions |
| CREDENTIAL | CredentialManager | Course/training certifications |
| POSITION | PositionManager | Active ongoing roles |
| INVESTMENT | InvestmentCohortManager | Investment participation |

---

## 🔐 Security Features

- **Timelock execution** prevents immediate governance attacks
- **Democratic verifier elections** ensure community accountability
- **M-of-N verification** for work validation
- **Appeal mechanisms** for disputed decisions
- **TreasuryAdapter guardrails** (1 spend/week, 10% cap, stablecoin allowlist)

## 📈 Testing & Coverage

All contracts maintain ≥86% test coverage:
- **Unit tests** for individual contract functionality
- **Integration tests** for cross-contract interactions
- **Fuzz testing** for input validation
- **Coverage gate** enforced in CI/CD

---

_For development workflow, see [.github/copilot-instructions.md](../../.github/copilot-instructions.md)._
