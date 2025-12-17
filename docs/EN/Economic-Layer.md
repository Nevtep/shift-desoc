# Economic Layer

## 1. Overview

The **Economic Layer** delivers Shift DeSoc's incentive engine by turning verified work, collective revenue, and community-managed capital into programmable, auditable financial flows. It supplies every community with a USDC-backed currency, a cohort-based investor framework, deterministic revenue routing, and a future-facing treasury bridge. Economic policy remains fully governance-controlled through `ParamController`, while work verification and coordination layers provide the inputs that trigger minting, distribution, and repayment events.

### Role in Shift Architecture

- Coordinates with **Verification Layer** to mint rewards after Claims finalize.
- Consumes governance policies from **ParamController** and executes timelock-approved parameter changes.
- Feeds worker compensation and investment outcomes back to **Coordination Layer** modules such as DraftsManager and RequestHub via events and analytics.
- Provides stable accounting for **Community Modules** (Marketplace, HousingManager, ProjectFactory) by exposing consistent payment primitives.

### Economic Stack Components

1. `CommunityToken`: 1:1 USDC-backed programmable currency with role-gated treasuries and emergency controls.
2. `RevenueRouter`: Waterfall distribution contract that enforces governance-defined splits and investor repayments.
3. `CohortRegistry`: Target ROI tracking system for investment cohorts with immutable terms and dynamic weighting.
4. `TreasuryAdapter`: Phase 2 bridge for multi-sig treasury execution (currently stubbed, documented for roadmap alignment).

## 2. Component Responsibilities

### 2.1 CommunityToken

- Maintains exact 1:1 USDC collateralization with optional redemption fee that routes to the community treasury.
- Exposes minting hooks for Claims, RevenueRouter, and other modules that need to pay workers or allocate incentives.
- Implements emergency pause and delayed emergency withdrawal flow to protect reserves under attack conditions.
- Tracks backing ratio and excess reserves so treasury operations cannot violate collateral requirements.

```solidity
contract CommunityToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    IERC20 public immutable USDC;
    uint256 public immutable communityId;
    uint256 public maxSupply;
    uint256 public redemptionFeeBps;
    address public treasury;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    function mint(uint256 usdcAmount) external returns (uint256 tokensIssued);
    function redeem(uint256 tokenAmount) external returns (uint256 usdcRedeemed);
    function withdrawFromTreasury(address recipient, uint256 amount, string calldata reason)
        external onlyRole(TREASURY_ROLE);
}
```

### 2.2 RevenueRouter

- Implements a deterministic waterfall: workers minimum → treasury base → investor pool → spillover.
- Reads distribution ratios, spillover rules, and accepted tokens from `ParamController` to stay policy-driven.
- Credits workers and treasury internally while routing investor repayments to `CohortRegistry` with weight-aware logic.
- Protects all revenue paths with `nonReentrant`, balance checks, and token allowlists.

```solidity
function routeRevenue(uint256 communityId, address token, uint256 amount)
    external onlyRole(DISTRIBUTOR_ROLE) nonReentrant
{
    uint256[3] memory splits = paramController.getRevenuePolicy(communityId);
    uint256 workersMin = (amount * splits[0]) / 10000;
    uint256 treasuryBase = (amount - workersMin) * splits[1] / (splits[1] + splits[2]);
    uint256 investorPool = amount - workersMin - treasuryBase;
    uint256 spill = _distributeToActiveCohorts(communityId, token, investorPool);
    _handleSpillover(communityId, token, spill, splits);
}
```

### 2.3 CohortRegistry

- Records immutable cohort terms (target ROI, priority weight, terms hash) and per-investor funding totals.
- Authorizes only `ValuableActionSBT` to record new investments, ensuring they are tied to verified contributions.
- Updates recovered revenue totals when RevenueRouter completes payments, automatically deactivating cohorts once the target ROI is achieved.
- Supplies weight calculations to RevenueRouter so investments receive repayment proportional to unrecovered principal and governance-defined priority.

```solidity
struct Cohort {
    uint256 id;
    uint256 communityId;
    uint16 targetRoiBps;
    uint64 createdAt;
    uint32 priorityWeight;
    uint256 investedTotal;
    uint256 recoveredTotal;
    bool active;
    bytes32 termsHash;
}

function getCohortWeight(uint256 cohortId, bool useWeights) external view returns (uint256);
function markRecovered(uint256 cohortId, uint256 amount) external onlyRevenueRouter;
function addInvestment(uint256 cohortId, address investor, uint256 amount) external onlyValuableActionSBT;
```

### 2.4 TreasuryAdapter (Phase 2)

- Placeholder contract slated to integrate governance-approved proposals with external treasuries like Gnosis Safe or Zodiac modules.
- Currently reverts `execute` calls, ensuring live deployments cannot mistakenly route funds through the unimplemented adapter.
- Documentation captures the target architecture: queued treasury operations, multi-sig thresholds, and governance-driven spend approvals.

## 3. Shared State & Accounting

Economic contracts share synchronized state to maintain provable solvency and deterministic distributions.

```solidity
// CommunityToken reserves
uint256 public totalSupply();
uint256 public maxSupply;
function getBackingRatio() external view returns (uint256 ratio);

// RevenueRouter pools
mapping(uint256 => mapping(address => uint256)) public workerPools;
mapping(uint256 => mapping(address => uint256)) public treasuryReserves;
mapping(uint256 => mapping(address => mapping(address => uint256))) public investorClaims;

// CohortRegistry investment tracking
mapping(uint256 => Cohort) public cohorts;
mapping(uint256 => address[]) public cohortInvestors;
mapping(uint256 => mapping(address => uint256)) public investedBy;
```

Key invariants:

- `USDC.balanceOf(CommunityToken) >= totalSupply()` except for allowable rounding tolerance.
- `Σ(workerPools) + Σ(treasuryReserves) + Σ(investorClaims) == Σ(revenue inputs)` per token, minus executed withdrawals.
- `recoveredTotal` never exceeds `investedTotal * targetRoiBps / 10000` because cohorts deactivate once the target ROI is satisfied.

## 4. Core Flows

### 4.1 Revenue Intake and Distribution

1. Off-chain business activity sends revenue (USDC or approved token) to the distributor.
2. Authorized distributor calls `routeRevenue`, which reads current splits from `ParamController`.
3. Workers minimum is credited to `workerPools`; treasury base increases `treasuryReserves`.
4. Remaining investor pool is distributed across active cohorts using `CohortRegistry.getCohortWeight`.
5. `markRecovered` updates cohort progress and deactivates any cohort that hits its target ROI.
6. Spillover flows to workers or treasury depending on policy, ensuring no stranded balances.

### 4.2 Investment Lifecycle

1. Governance (via timelock) calls `createCohort` with immutable target ROI, weight, and terms hash.
2. `ValuableActionSBT` mints investment SBTs and records deposits through `addInvestment`.
3. RevenueRouter repayments accumulate in `investorClaims[cohortId][investor][token]`.
4. Investors withdraw earnings directly from RevenueRouter once claims exceed zero, with no need for intermediate custodians.
5. When cohorts deactivate, future revenue bypasses them automatically, benefiting workers and treasury.

### 4.3 Work Compensation

- Claims contract triggers `CommunityToken.mintTo` or transfers existing balances to workers immediately after verification.
- Workers can continue using CommunityToken inside Shift modules or redeem to USDC (`redeem`) with optional fee routed to treasury.
- RevenueRouter `allocateWorkerRevenue` pays out task-based bonuses or profit sharing by crediting `workerPools`, which workers withdraw via authenticated calls.

### 4.4 Treasury Operations and Emergency Handling

- Treasury managers withdraw excess USDC through `withdrawFromTreasury`, which requires reserves to stay ≥ total supply.
- Emergency role can pause the token or initiate a delayed emergency withdrawal; execution requires waiting out the predefined cooldown and recording the reason on-chain.
- Once TreasuryAdapter ships, governance proposals will queue multi-sig treasury moves instead of direct withdrawals, aligning community votes with off-chain custody.

## 5. Economic Policy Controls

Governance steers economic behavior through `ParamController` without redeploying contracts:

- `getRevenuePolicy(communityId)` returns `[workersBps, treasuryBps, investorsBps, spilloverTarget]`, empowering rapid iteration on revenue sharing.
- `getCohortParams(communityId)` limits active cohorts and toggles weighting schemes (pure unrecovered vs unrecovered * priority).
- `setRedemptionFee`, `setMaxSupply`, and treasury role assignments within CommunityToken are gated by timelock-controlled `DEFAULT_ADMIN_ROLE`.
- Cohort creation requires timelock execution, ensuring investor terms cannot be diluted without full governance approval.

Communities can transition from investor-heavy splits during bootstrap phases to worker-first distributions as cohorts complete, all through parameter updates and new governance proposals.

## 6. Security & Risk Mitigation

- **Collateral Assurance**: CommunityToken enforces backing checks on every withdrawal and exposes `getBackingRatio()` for monitoring dashboards.
- **Access Control Separation**: Distinct MINTER, TREASURY, DISTRIBUTOR, and EMERGENCY roles minimize blast radius of compromised keys.
- **Reentrancy Guardrails**: RevenueRouter and CommunityToken wrap sensitive functions in `nonReentrant` and leverage SafeERC20 for token transfers.
- **Immutable Investment Terms**: Cohort parameters cannot be altered post-creation; tampering requires deploying a new cohort via governance.
- **Automatic ROI Enforcement**: `markRecovered` deactivates cohorts when targets are met, preventing overpayment to investors.
- **Emergency Pauses**: CommunityToken can halt transfers and redemptions during incidents while governance plans remediation.

## 7. Integration Points

- **Claims**: Calls `CommunityToken.mintTo` for worker rewards and `RevenueRouter.allocateWorkerRevenue` for share-based payouts.
- **Verifier Stack**: Guarantees only verified investments reach CohortRegistry because `addInvestment` is restricted to `ValuableActionSBT`.
- **Governance Core**: Uses MembershipToken votes to approve revenue split adjustments, cohort creations, and role assignments.
- **Community Modules**: Marketplace, HousingManager, and ProjectFactory rely on CommunityToken for deterministic settlement and leverage RevenueRouter analytics to price services.
- **External Treasury Systems**: Future TreasuryAdapter release will relay approved proposals to Gnosis Safe or Zodiac modules without bypassing on-chain governance history.

## 8. Testing & Monitoring

- Foundry tests in `packages/foundry/test/` cover multi-choice voting impacts on economic parameters (`MultiChoice.t.sol`) and component-specific suites validate minting, redemption, cohort weight math, and revenue routing.
- Coverage gate (`pnpm cov:gate`) enforces ≥86% ensuring economic-critical paths remain fully instrumented.
- Suggested on-chain monitors:
  - Backing ratio drift alert when `getBackingRatio() < 9990` (99.9%).
  - Investor cohort completion notifications using `CohortDeactivated` events.
  - RevenueRouter spillover tracking to confirm policy behaviors after parameter changes.

## 9. Roadmap & Pending Work

- **TreasuryAdapter**: Phase 2 will implement governance-driven Safe transactions, automated spending limits, and emergency pause bridges.
- **Yield Strategies**: Future CommunityToken extensions may support diversified backing and yield distribution while respecting collateral guarantees.
- **Analytics**: Planned dashboards will visualize cohort ROI progress, worker vs investor share trends, and treasury health across communities.

The Economic Layer ensures every verified contribution, governance decision, and revenue event feeds into a transparent, programmable economy that communities can adapt without redeploying core contracts.