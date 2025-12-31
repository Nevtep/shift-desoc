# Governance Core

## 1. Overview

The **Governance Core** forms the democratic decision-making backbone of the Shift DeSoc protocol. It implements a merit-based governance system where voting power is earned through verified contributions rather than purchased, enabling communities to make both binary and nuanced multi-choice decisions with built-in security through timelock-controlled execution.

### Role in Shift Architecture

The Governance Core sits at Layer 2 of the Shift system architecture, mediating between:

- **Layer 1 (Community Coordination)**: Proposals escalated from RequestHub and DraftsManager
- **Layer 3 (Work Verification)**: Minting governance tokens when Claims are verified
- **Layer 4 (Economic)**: Parameter changes to revenue distribution, treasury limits, token economics
- **Layer 5 (Community Modules)**: Configuration updates to marketplace rules, housing policies, project funding

### Component Integration

The Governance Core comprises three tightly integrated smart contracts:

1. **ShiftGovernor**: Manages proposal lifecycle, voting periods, and execution through timelock
2. **MembershipTokenERC20Votes**: Provides merit-based voting power through earned tokens
3. **CountingMultiChoice**: Enables weighted preference distribution across multiple proposal options

**Governance Flow**: All sensitive parameter changes and module configurations must route through `Governor → Timelock → Target Contracts`, ensuring democratic oversight with execution delays that allow community review and potential cancellation of malicious proposals.

### Key Innovations

- **Merit-Based Voting Power**: Unlike traditional token governance, voting power can only be earned through completing verified ValuableActions, preventing plutocratic capture
- **Multi-Choice Voting**: Communities can express nuanced preferences (e.g., "60% support Option A, 40% support Option B") rather than binary yes/no choices
- **Timelock Security**: All governance decisions execute with configurable delays, providing security against rushed or malicious proposals
- **Backward Compatibility**: Full support for standard OpenZeppelin Governor patterns alongside multi-choice innovations

## 2. Components

### 2.1 ShiftGovernor

**Purpose**: ShiftGovernor is Shift DeSoc's governance orchestrator that extends OpenZeppelin's battle-tested Governor with multi-choice voting capabilities. It manages the complete proposal lifecycle from creation through secure execution while supporting both traditional binary voting and innovative preference distribution.

**Responsibilities**:

- Proposal creation with validation against eligibility thresholds
- Voting period management with configurable delays and durations
- Integration with CountingMultiChoice for multi-option vote tallying
- Timelock-controlled execution with security delays
- Event emission for frontend governance applications
- Support for both binary and multi-choice governance decisions

**Key Configuration Parameters**:

| Parameter | Default Value | Purpose |
|-----------|--------------|---------|
| Voting Delay | 1 day | Prevents flash governance attacks by requiring snapshot delay |
| Voting Period | 5 days | Sufficient time for community participation |
| Proposal Threshold | 0 tokens | Inclusive participation (configurable per community) |
| Quorum | 4% | Minimum participation required for proposal validity |
| Timelock | TimelockController | All proposals execute through timelock for security |

**Main External Functions**:

```solidity
// Binary proposal creation (standard OpenZeppelin)
function propose(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description
) public returns (uint256 proposalId)

// Multi-choice proposal creation (Shift innovation)
function proposeMultiChoice(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description,
    uint8 numOptions  // Must be ≥2
) public returns (uint256 proposalId)

// Binary voting (standard)
function castVote(uint256 proposalId, uint8 support) public
function castVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) public
function castVoteBySig(uint256 proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) public

// Multi-choice voting (Shift innovation)
function castVoteMultiChoice(
    uint256 proposalId,
    uint256[] calldata weights,  // Distribution percentages (must sum ≤ 100%)
    string calldata reason
) external

// Proposal execution flow
function queue(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public
function execute(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public payable
function cancel(address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bytes32 descriptionHash) public

// State queries
function state(uint256 proposalId) public view returns (ProposalState)
function proposalSnapshot(uint256 proposalId) public view returns (uint256)
function proposalDeadline(uint256 proposalId) public view returns (uint256)
```

**Important Events**:

```solidity
event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description);
event MultiChoiceProposalCreated(uint256 indexed proposalId, address indexed proposer, uint8 numOptions, string description);
event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason);
event MultiChoiceVoteCast(uint256 indexed proposalId, address indexed voter, uint256[] weights, uint256 totalWeight, string reason);
event ProposalQueued(uint256 proposalId, uint256 eta);
event ProposalExecuted(uint256 proposalId);
event ProposalCanceled(uint256 proposalId);
event MultiCounterUpdated(address indexed oldCounter, address indexed newCounter);
```

**Custom Extensions vs OpenZeppelin**:

- **Multi-Choice Support**: Adds `proposeMultiChoice()` and `castVoteMultiChoice()` beyond standard Governor
- **Counting Module Integration**: Delegates vote tallying to CountingMultiChoice for separation of concerns
- **Frontend Helper Functions**: `isMultiChoice()`, `numOptionsOf()`, `getMultiChoiceTotals()` for UI integration
- **Merit-Based Power**: Uses MembershipTokenERC20Votes for earned voting power rather than purchased tokens

### 2.2 MembershipTokenERC20Votes

**Purpose**: MembershipTokenERC20Votes is the **pure merit-based governance token** for Shift communities. Unlike traditional governance tokens that can be purchased, MembershipTokens can **only be earned** by completing verified ValuableActions. This creates a governance system where voting power directly reflects proven contributions rather than financial investment.

**Core Principle**: "Governance power is EARNED, not bought" - tokens minted exclusively when Claims are approved for ValuableAction completion.

**Who Gets Tokens & How**:

- **Workers**: Minted automatically when Claims contract approves completed work
- **Founders**: Minimal initial allocation via CommunityFactory during community bootstrap
- **NO Purchase Mechanism**: Cannot be bought with ETH/USDC/other currencies
- **NO Staking Rewards**: Only earned through verified contributions
- **NO Airdrops**: No free distribution - must contribute value

**Delegation Model**:

The token implements full ERC20Votes delegation capabilities:

```solidity
// Self-delegation (activate voting power)
function delegate(address delegatee) public

// Delegate to another address (liquid democracy)
function delegate(address expert) public

// Gasless delegation via EIP-2612 permit
function delegateBySig(
    address delegatee,
    uint256 nonce,
    uint256 expiry,
    uint8 v, bytes32 r, bytes32 s
) public
```

**Delegation Features**:

- **Self-Delegation Required**: Users must delegate to themselves or others to activate voting power
- **Liquid Democracy**: Enables delegation to trusted community experts
- **Multi-Level Delegation**: Delegation chains supported with cycle detection
- **Real-Time Updates**: Vote weights update automatically on token transfers
- **Gasless Operations**: EIP-2612 permit enables meta-transactions without gas costs

**Snapshot Mechanism & Governor Integration**:

```solidity
// Historical voting power (used by Governor for proposals)
function getPastVotes(address account, uint256 blockNumber) public view returns (uint256)

// Historical total supply (for quorum calculations)
function getPastTotalSupply(uint256 blockNumber) public view returns (uint256)
```

**How Snapshots Work**:

1. Proposal created at block N
2. Governor reads `getPastVotes(voter, N)` when tallying votes
3. Vote weights **locked at block N** - cannot be manipulated after proposal creation
4. Prevents flash loan attacks and vote power manipulation

**Integration with Governor Voting**:

- Governor reads voting power at proposal snapshot block
- 1 token = 1 vote (no complex calculations)
- Delegation automatically reflected in voting power
- Historical snapshots prevent retroactive vote manipulation

**Special Minting Restrictions**:

```solidity
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens max

function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
    require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
    _mint(to, amount);
    emit TokensMintedForWork(to, amount, msg.sender, reason);
}
```

**Access Control**:

- **MINTER_ROLE**: Only Claims contract and CommunityFactory can mint tokens
- **GOVERNANCE_ROLE**: Community governance for role management and emergency functions
- **No PAUSER_ROLE**: Tokens always transferable to prevent governance lockout
- **Supply Cap**: Hard 100M token limit prevents inflation attacks

**Audit Trail**:

- All minting events logged with reason string
- Transparent on-chain record of who earned tokens and why
- Community can verify merit-based distribution

### 2.3 CountingMultiChoice

**Purpose**: CountingMultiChoice is the **voting calculation engine** that enables Shift communities to express nuanced preferences through weighted distribution across multiple proposal options. It extends traditional binary voting with sophisticated preference expression while maintaining blockchain transparency and verifiability.

**Why Multi-Choice Voting is Needed**:

Traditional governance forces binary choices that oversimplify complex community decisions:

- **Binary Problem**: "Should we spend $50K on Feature A or Feature B?" → Only yes/no, can't express preference nuances
- **Multi-Choice Solution**: "Distribute your voting power: 60% Feature A, 30% Feature B, 10% Research Phase" → Captures true community preference

**Real-World Use Cases**:

- Budget allocation across multiple proposals
- Selecting among multiple design options
- Expressing preference intensity (strong vs weak support)
- Ranked choice / instant runoff voting
- Resource distribution decisions

**Option Modeling & Storage**:

```solidity
struct MultiChoiceConfig {
    bool enabled;              // Whether multi-choice is active for this proposal
    uint8 numOptions;         // Number of available options (2-10)
    uint256 totalWeight;      // Sum of all cast votes
    uint256[] optionTotals;   // Vote total per option
}

struct ProposalVote {
    uint256 againstVotes;     // Binary "No" votes (backward compatibility)
    uint256 forVotes;         // Binary "Yes" votes
    uint256 abstainVotes;     // Binary abstentions
    mapping(uint256 => uint256) optionVotes;     // Multi-choice vote weights per option
    mapping(address => bool) hasVoted;           // Double-voting prevention
    mapping(address => uint256[]) voterWeights;  // Individual weight distributions
}
```

**Storage Design Philosophy**:

- Supports both binary and multi-choice in unified structure
- Maintains full voting history for transparency
- Enables analytics and voter behavior analysis
- Gas-efficient storage with array packing

**How Voters Cast Multi-Choice Votes**:

```solidity
function castVoteMulti(
    uint256 proposalId,
    address voter,
    uint256 weight,              // Voter's total voting power
    uint256[] calldata weights,  // Distribution percentages (basis points, 1e18 = 100%)
    string calldata reason
) external returns (uint256 weightUsed)
```

**Voting Process Example**:

```solidity
// Voter has 1000 tokens of voting power
// Distributes across 4 options

uint256[] memory weights = new uint256[](4);
weights[0] = 0.5e18;  // 50% (500 votes) to Option A
weights[1] = 0.3e18;  // 30% (300 votes) to Option B
weights[2] = 0.2e18;  // 20% (200 votes) to Option C
weights[3] = 0;       // 0% (0 votes) to Option D

castVoteMulti(proposalId, voter, 1000e18, weights, "Prefer A with B as fallback");
```

**Weight Distribution Rules**:

- Weights expressed as percentages in basis points (1e18 = 100%)
- Total distribution must sum ≤ 100% (≤ 1e18)
- Individual weights can be 0-100%
- Voters can express partial support across multiple options
- Unused weight (e.g., 70% distributed, 30% unused) represents intentional abstention

**Outcome Computation**:

```solidity
// Calculate winning option
function getWinningOption(uint256 proposalId) external view returns (uint256 winningOption, uint256 winningVotes) {
    uint8 numOptions = _multiConfigs[proposalId].numOptions;
    uint256 maxVotes = 0;
    uint256 winner = 0;

    for (uint256 i = 0; i < numOptions; i++) {
        uint256 optionVotes = _proposalVotes[proposalId].optionVotes[i];
        if (optionVotes > maxVotes) {
            maxVotes = optionVotes;
            winner = i;
        }
    }

    return (winner, maxVotes);
}
```

**How Results Are Used**:

- **Simple Plurality**: Option with most weighted votes wins
- **Democratic Reflection**: Outcome reflects distributed community preference
- **Transparent Tallying**: All vote weights publicly verifiable on-chain
- **Analytics Support**: Full voting data available for post-decision analysis

## 3. Data Structures & State

The Governance Core maintains several critical data structures across its three contracts to track proposals, votes, voting power, and delegation.

### Proposal State (ShiftGovernor)

```solidity
// Proposal lifecycle states (inherited from OpenZeppelin Governor)
enum ProposalState {
    Pending,      // Created, waiting for voting delay
    Active,       // Voting period open
    Canceled,     // Canceled by proposer or governance
    Defeated,     // Voting failed (quorum or majority not reached)
    Succeeded,    // Voting passed
    Queued,       // Queued in timelock
    Expired,      // Timelock delay passed without execution
    Executed      // Successfully executed
}

// Multi-choice metadata
mapping(uint256 => uint8) private _numOptions;  // Options per proposal
```

**Proposal Lifecycle Flow**: `Pending → Active → Succeeded → Queued → Executed`

### Vote Storage (CountingMultiChoice)

```solidity
struct ProposalVote {
    // Binary voting (backward compatibility)
    uint256 againstVotes;     // Total "No" votes
    uint256 forVotes;         // Total "Yes" votes
    uint256 abstainVotes;     // Total abstentions

    // Multi-choice voting
    mapping(uint256 => uint256) optionVotes;     // Vote weight per option
    mapping(address => bool) hasVoted;           // Double-voting prevention
    mapping(address => uint256[]) voterWeights;  // Voter's weight distribution
}

mapping(uint256 => ProposalVote) private _proposalVotes;

struct MultiChoiceConfig {
    bool enabled;              // Multi-choice activation flag
    uint8 numOptions;         // Number of options (2-10)
    uint256 totalWeight;      // Total votes cast
    uint256[] optionTotals;   // Per-option totals
}

mapping(uint256 => MultiChoiceConfig) private _multiConfigs;
```

**Storage Considerations**:

- Nested mappings for gas-efficient vote tracking
- Array storage for option totals (limited to 10 options for UI practicality)
- Voter weight arrays preserved for transparency and analytics
- Double-voting prevention via `hasVoted` mapping

### Delegation & Voting Power Snapshots (MembershipTokenERC20Votes)

```solidity
// Inherited from OpenZeppelin ERC20Votes
struct Checkpoint {
    uint32 fromBlock;    // Block number when checkpoint created
    uint224 votes;       // Voting power at that block
}

// Per-address checkpoints for historical voting power
mapping(address => Checkpoint[]) private _checkpoints;

// Total supply checkpoints for quorum calculations
Checkpoint[] private _totalSupplyCheckpoints;

// Current delegation mappings
mapping(address => address) private _delegates;
```

**Snapshot Mechanism**:

- Checkpoints created on delegation changes and token transfers
- Historical voting power read via binary search of checkpoint array
- Prevents retroactive vote manipulation (snapshot locked at proposal creation)
- Gas-efficient storage with block number packing (32-bit) and vote amount (224-bit)

**Delegation Chain Representation**:

```
User A (1000 tokens) → delegates to → Expert B (500 own + 1000 delegated = 1500 total)
User C (500 tokens) → self-delegated (500 total)
User D (200 tokens) → delegates to → User A (0 effective - delegation chain)
```

### Access Control State

```solidity
// MembershipTokenERC20Votes roles
bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
mapping(bytes32 => RoleData) private _roles;  // Inherited from AccessControlEnumerable

// ShiftGovernor timelock integration
TimelockController public timelock;
address public multiCounter;  // CountingMultiChoice address
```

**Role Assignments**:

- **MINTER_ROLE**: Claims contract, CommunityFactory (can mint tokens)
- **GOVERNANCE_ROLE**: ShiftGovernor via timelock (parameter changes, emergency functions)
- **Governor Access**: CountingMultiChoice only callable by Governor
- **Timelock Executor**: Only timelock can execute approved governance proposals

## 4. Governance Flows

### 4.1 Proposal Lifecycle

**Step-by-Step Binary Proposal Flow**:

```
1. Proposal Creation
   ├─ Precondition: Proposer has ≥ proposalThreshold() tokens at current block
   ├─ Action: propose(targets, values, calldatas, description)
   ├─ State: Pending
   └─ Snapshot: Voting power locked at block N

2. Voting Delay Period
   ├─ Duration: 1 day (configurable)
   ├─ Purpose: Prevent flash governance attacks
   └─ State: Pending → Active (after delay)

3. Voting Period
   ├─ Duration: 5 days (configurable)
   ├─ Actions: castVote(proposalId, support)
   │   ├─ Support=0: Against
   │   ├─ Support=1: For
   │   └─ Support=2: Abstain
   ├─ State: Active
   └─ Vote Power: Read from getPastVotes(voter, snapshotBlock)

4. Voting Conclusion
   ├─ Quorum Check: Total votes ≥ 4% of token supply?
   ├─ Majority Check: For votes > Against votes?
   └─ State: Active → Succeeded or Defeated

5. Timelock Queue
   ├─ Precondition: Proposal state = Succeeded
   ├─ Action: queue(targets, values, calldatas, descriptionHash)
   ├─ Effect: Schedules execution in timelock
   └─ State: Succeeded → Queued

6. Execution Delay
   ├─ Duration: 48 hours (configurable in timelock)
   ├─ Purpose: Community review period, malicious proposal cancellation window
   └─ State: Queued

7. Execution
   ├─ Precondition: Timelock delay elapsed
   ├─ Action: execute(targets, values, calldatas, descriptionHash)
   ├─ Effect: Calls target contracts with specified calldata
   └─ State: Queued → Executed
```

**Step-by-Step Multi-Choice Proposal Flow**:

```
1. Multi-Choice Proposal Creation
   ├─ Precondition: Proposer has ≥ proposalThreshold() tokens
   ├─ Action: proposeMultiChoice(targets, values, calldatas, description, numOptions)
   ├─ Validation: numOptions ≥ 2 and ≤ 10
   ├─ Effect: Creates proposal + enables multi-choice in CountingMultiChoice
   └─ State: Pending

2. Voting Delay Period (same as binary)
   └─ State: Pending → Active

3. Multi-Choice Voting Period
   ├─ Duration: 5 days
   ├─ Actions: castVoteMultiChoice(proposalId, weights[], reason)
   │   ├─ weights[] length must match numOptions
   │   ├─ weights[] sum must be ≤ 1e18 (100%)
   │   └─ Individual weights can be 0-1e18
   ├─ Processing:
   │   ├─ Read voter power: getPastVotes(voter, snapshotBlock)
   │   ├─ Apply distribution: optionVotes[i] += (voterPower * weights[i]) / 1e18
   │   └─ Record voter weights for transparency
   └─ State: Active

4. Result Calculation
   ├─ Winner: Option with highest total optionVotes
   ├─ Quorum: Total participation ≥ 4% of token supply
   └─ State: Active → Succeeded or Defeated

5-7. Queue, Delay, Execute (same as binary)
```

**Proposer Preconditions**:

- Must hold ≥ `proposalThreshold()` voting power at current block
- Default threshold: 0 tokens (inclusive participation)
- Community can increase via governance for spam prevention
- Voting power from delegated tokens counts toward threshold

**Cancellation Flow**:

```
Cancellation Triggers
├─ By Proposer: If proposer's voting power drops below threshold
├─ By Governance: Via emergency governance vote
└─ By Timelock Admin: For critical security issues

Cancellation Effect
├─ State: Any → Canceled
├─ Cleanup: Multi-choice config deleted (if applicable)
└─ Irreversible: Cannot un-cancel proposal
```

### 4.2 Voting & Vote Counting

**Binary Voting Process**:

```
1. Vote Validation
   ├─ Check: Is proposal in Active state?
   ├─ Check: Has voter already voted?
   └─ Check: Does voter have voting power > 0?

2. Read Voting Power
   ├─ Source: MembershipTokenERC20Votes
   ├─ Function: getPastVotes(voter, proposalSnapshot(proposalId))
   ├─ Snapshot: Power locked at proposal creation block
   └─ Delegation: Includes delegated votes

3. Record Vote
   ├─ CountingMultiChoice._countVote(proposalId, voter, support, weight, params)
   ├─ Update: againstVotes / forVotes / abstainVotes
   ├─ Mark: hasVoted[voter] = true
   └─ Emit: VoteCast(voter, proposalId, support, weight, reason)

4. Vote Aggregation
   ├─ For: Sum of all "For" votes
   ├─ Against: Sum of all "Against" votes
   └─ Abstain: Sum of all "Abstain" votes (counts toward quorum, not majority)
```

**Multi-Choice Voting Process**:

```
1. Multi-Choice Validation
   ├─ Check: Is multi-choice enabled for proposal?
   ├─ Check: Is proposal in Active state?
   ├─ Check: Has voter already voted?
   ├─ Check: weights[] length == numOptions?
   ├─ Check: sum(weights[]) ≤ 1e18 (100%)?
   └─ Check: Voter has voting power > 0?

2. Read Voting Power (Snapshot)
   ├─ Source: MembershipTokenERC20Votes.getPastVotes()
   ├─ Snapshot Block: proposalSnapshot(proposalId)
   └─ Prevents: Flash loan voting attacks

3. Distribute Voting Power
   ├─ For each option i:
   │   ├─ Calculate: actualVotes[i] = (voterPower * weights[i]) / 1e18
   │   ├─ Update: optionVotes[i] += actualVotes[i]
   │   └─ Track: multiConfigs[proposalId].optionTotals[i] += actualVotes[i]
   ├─ Record: voterWeights[voter] = weights[]
   └─ Mark: hasVoted[voter] = true

4. Aggregate Results
   ├─ Per Option: optionVotes[0..N-1]
   ├─ Total Weight: sum of all option votes
   ├─ Winner: max(optionVotes[0..N-1])
   └─ Emit: VoteMultiCast(voter, proposalId, weights, totalWeight, reason)
```

**How Voting Power is Read**:

```solidity
// Governor queries voting power at snapshot block
uint256 voterPower = token.getPastVotes(voter, proposalSnapshot(proposalId));

// Snapshot mechanism prevents manipulation:
// 1. Proposal created at block 1000
// 2. Snapshot locked at block 1000
// 3. Voter buys tokens at block 1005
// 4. Voter votes at block 1010
// 5. Voting power = balance at block 1000 (zero) ← prevents attack
```

**Abstain / Against / For / Multi-Choice Handling**:

| Vote Type | Binary Encoding | Effect on Quorum | Effect on Majority |
|-----------|----------------|------------------|-------------------|
| Against | `support=0` | Counts toward quorum | Against majority |
| For | `support=1` | Counts toward quorum | For majority |
| Abstain | `support=2` | Counts toward quorum | No effect on majority |
| Multi-Choice | `weights[]` | Sum of all weights counts | Highest weight option wins |

**Proposal Success Criteria**:

```solidity
// Binary Proposal
bool quorumReached = (forVotes + againstVotes + abstainVotes) >= quorum(proposalSnapshot);
bool majorityApproved = forVotes > againstVotes;
bool succeeded = quorumReached && majorityApproved;

// Multi-Choice Proposal
bool quorumReached = totalWeight >= quorum(proposalSnapshot);
bool hasWinner = max(optionVotes) > 0;
bool succeeded = quorumReached && hasWinner;
uint256 winningOption = argmax(optionVotes); // Option with highest votes
```

### 4.3 Parameter Updates & Integration

**Governor ↔ ParamController Integration**:

```solidity
// ParamController holds community parameters
contract ParamController {
    struct CommunityParams {
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercentage;
        uint256 timelockDelay;
        // ... economic parameters
    }

    mapping(uint256 => CommunityParams) public communityParams;

    // Only callable by timelock (governance)
    function updateParameter(
        uint256 communityId,
        bytes32 paramKey,
        uint256 newValue
    ) external onlyRole(GOVERNANCE_ROLE) {
        // Governance-controlled parameter updates
    }
}
```

**Parameter Update Flow**:

```
1. Community Discussion
   ├─ RequestHub: Community discusses need for parameter change
   ├─ DraftsManager: Draft proposal created with new parameter values
   └─ Escalation: Draft escalated to formal governance proposal

2. Governance Proposal
   ├─ Target: ParamController.updateParameter()
   ├─ Calldata: encode(communityId, "votingPeriod", 7 days)
   └─ Description: "Extend voting period to 7 days for complex decisions"

3. Voting & Approval
   ├─ Vote Period: 5 days
   ├─ Quorum: 4% participation
   └─ Approval: Majority votes "For"

4. Timelock Queue
   ├─ Delay: 48 hours
   └─ Review: Community can review and potentially cancel

5. Execution
   ├─ Executor: Timelock calls ParamController.updateParameter()
   ├─ Effect: votingPeriod updated from 5 days to 7 days
   └─ Future Proposals: Use new 7-day voting period
```

**Governor ↔ Timelock Integration**:

```solidity
// ShiftGovernor configuration
function _executor() internal view override returns (address) {
    return address(timelock);  // All execution through timelock
}

// Timelock role structure
contract TimelockController {
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");

    // Roles assigned to Governor
    // PROPOSER_ROLE: Governor can queue operations
    // EXECUTOR_ROLE: Anyone can execute (after delay)
    // CANCELLER_ROLE: Governor can cancel malicious proposals
}
```

**Timelock Security Flow**:

```
Proposal Approval → Queue in Timelock → Delay Period → Execution

During Delay Period:
├─ Community Review: Analyze impact of proposed changes
├─ Security Analysis: Check for malicious calldata or vulnerabilities
├─ Cancellation Window: Governor can cancel if issues discovered
└─ Media Coverage: For significant governance decisions
```

**Integration with Other Core Contracts**:

| Target Contract | Governance Functions | Parameter Examples |
|----------------|---------------------|-------------------|
| ParamController | `updateParameter(key, value)` | Voting periods, quorum, thresholds |
| ValuableActionRegistry | `updateAction(actionId, params)` | Token rewards, verification requirements |
| TreasuryAdapter | `updateSpendingLimit(limit)` | Max spending per period |
| RevenueRouter | `updateSplit(workers%, treasury%, investors%)` | Revenue distribution ratios |
| CommunityToken | `updateBackingAssets(assets[])` | Approved collateral tokens |
| VerifierElection | `grantVerifierPower(verifier, power)` | Verifier set management |

**Critical Invariants**:

- ✅ **NO Direct Mutable Parameters**: All parameter changes MUST go through Governor → Timelock
- ✅ **Timelock Enforcement**: Only timelock can call governance-gated functions
- ✅ **Role Protection**: GOVERNANCE_ROLE assigned exclusively to timelock
- ✅ **Delay Requirement**: All governance changes subject to timelock delay
- ✅ **Cancellation Rights**: Governor can cancel queued proposals during delay

**Anti-Pattern Detection**:

```solidity
// ❌ BAD: Direct parameter updates (bypasses governance)
function updateVotingPeriod(uint256 newPeriod) external onlyOwner {
    votingPeriod = newPeriod;  // WRONG - no governance oversight
}

// ✅ GOOD: Governance-controlled parameters
function updateVotingPeriod(uint256 newPeriod) external onlyRole(GOVERNANCE_ROLE) {
    votingPeriod = newPeriod;  // Requires timelock (governance approval)
}

// ✅ BETTER: Parameters in dedicated ParamController
function updateParameter(bytes32 key, uint256 value) external onlyRole(GOVERNANCE_ROLE) {
    params[key] = value;  // Centralized parameter management
}
```

## 5. Security & Invariants

### Access Control

**Proposal Creation**:

- **Who Can Propose**: Any address with ≥ `proposalThreshold()` voting power at current block
- **Threshold Default**: 0 tokens (inclusive participation)
- **Threshold Updates**: Via governance proposal to ParamController
- **Spam Prevention**: Configurable threshold increased for large communities

**Proposal Execution**:

- **Who Can Execute**: Anyone (after timelock delay expires)
- **Execution Requirement**: Proposal must be in `Queued` state
- **Delay Enforcement**: Timelock enforces minimum delay (default 48 hours)
- **Role Protection**: Only timelock can call target contract governance functions

**Proposal Cancellation**:

- **Who Can Cancel**: 
  - Proposer (if voting power drops below threshold)
  - Timelock admin (emergency security issues)
  - Guardian role (if configured for critical emergencies)
- **When**: Any time before execution
- **Effect**: Irreversible state change to `Canceled`

**Parameter Changes**:

- **Who**: Only timelock (requires successful governance vote)
- **What**: All governance parameters, economic splits, module configurations
- **How**: Governor → Timelock → Target Contract governance functions
- **Delay**: Minimum timelock delay (48 hours default)

### Reentrancy & Cross-Module Calls

**Reentrancy Protection**:

- **Governor Execution**: Inherited OpenZeppelin reentrancy guards on `execute()`
- **Vote Casting**: No external calls during vote recording (reentrancy-safe)
- **Token Transfers**: ERC20Votes uses OpenZeppelin's reentrancy-safe patterns
- **Timelock Operations**: Sequential execution with state checks

**Cross-Module Call Safety**:

```
Proposal Execution Flow:
├─ Governor.execute() [Reentrancy Guard]
│   └─ Timelock.execute() [Reentrancy Guard]
│       └─ TargetContract.governanceFunction() [Should have access control]
│           ├─ State Changes
│           └─ External Calls [Potential reentrancy risk]

Safety Measures:
├─ Access Control: Only timelock can call governanceFunction()
├─ CEI Pattern: Check-Effects-Interactions pattern in target contracts
├─ Reentrancy Guards: On all state-changing governance functions
└─ Atomic Execution: Multi-call proposals execute atomically or revert entirely
```

**Cross-Contract Integration Patterns**:

```solidity
// Safe pattern: Access control + state changes before external calls
function approveClaim(uint256 claimId) external onlyRole(VERIFIER_ROLE) {
    // 1. Checks
    require(claims[claimId].state == ClaimState.Pending, "Invalid state");

    // 2. Effects
    claims[claimId].state = ClaimState.Approved;

    // 3. Interactions (after state changes)
    membershipToken.mint(
        claims[claimId].worker,
        action.membershipTokenReward,
        "Claim approved"
    );
}
```

### Economic Attacks

**Flash Loan Attack Mitigation**:

```solidity
// Snapshot-based voting power prevents flash loan attacks

Attack Scenario:
1. Attacker borrows 1M tokens via flash loan at block 1000
2. Attacker tries to vote on proposal created at block 990
3. Voting power = getPastVotes(attacker, 990) = 0 (no tokens at snapshot)
4. Attack fails - cannot vote with borrowed tokens

Protection Mechanism:
├─ Voting power locked at proposal creation (snapshot block)
├─ Flash loans happen after snapshot → no voting power
├─ Voting delay (1 day) makes single-block attacks impossible
└─ Must hold tokens before proposal creation to vote
```

**Vote Buying Risks**:

```solidity
// Vote buying risk: Attacker buys tokens to influence vote

Partial Mitigation:
├─ Merit-Based Tokens: Cannot buy MembershipTokens (only earn through work)
├─ Secondary Market: Limited (most holders earned tokens, unlikely to sell)
├─ Supply Cap: Maximum 100M tokens limits whale accumulation
└─ Timelock Delay: 48 hour review period allows community response

Remaining Risk:
├─ Founders with large allocations could sell to malicious actors
├─ Long-term contributors might sell accumulated tokens
└─ Governance capture remains theoretically possible

Additional Safeguards:
├─ Community monitoring of large token transfers
├─ Social accountability (earned tokens carry reputation)
└─ Timelock cancellation if malicious proposals detected
```

**Governance Capture Prevention**:

| Risk Vector | Mitigation Strategy |
|------------|---------------------|
| Whale Accumulation | Merit-only minting (cannot buy bulk tokens) |
| Founder Control | Minimal founder allocation, distributed among multiple founders |
| Verifier Collusion | Separate VPS governance controls verifier sets |
| Flash Governance | 1-day voting delay + snapshot-based power |
| Economic Bribery | Social reputation (earned tokens), community monitoring |
| Timelock Bypass | No mechanism to bypass timelock delay |
| Parameter Manipulation | All parameters governance-controlled (no admin backdoors) |

### Critical Invariants

**Governance Invariants**:

```solidity
// 1. Only timelock can execute governance functions
invariant OnlyTimelockExecutes:
    forall contract C, function f where hasModifier(f, onlyRole(GOVERNANCE_ROLE)):
        msg.sender == timelock

// 2. Voting power at snapshot cannot change retroactively
invariant VotingPowerImmutable:
    forall proposal P, voter V, block B where B == proposalSnapshot(P):
        getPastVotes(V, B) == constant  // Cannot change after snapshot

// 3. Proposals cannot execute without timelock delay
invariant TimelockDelayEnforced:
    forall proposal P:
        state(P) == Executed => 
        executionTime(P) >= queueTime(P) + timelockDelay

// 4. Double voting prevention
invariant NoDoubleVoting:
    forall proposal P, voter V:
        hasVoted[P][V] == true => canVote(P, V) == false

// 5. Supply cap enforcement
invariant SupplyCapProtection:
    totalSupply(MembershipToken) <= MAX_SUPPLY

// 6. Vote weight distribution validity
invariant WeightDistributionValid:
    forall proposal P, voter V:
        sum(voterWeights[P][V]) <= 1e18  // Cannot exceed 100%

// 7. Quorum calculation consistency
invariant QuorumConsistency:
    forall proposal P:
        quorum(P) == (totalSupply(snapshotBlock(P)) * quorumPercentage) / 100
```

**Economic Invariants**:

```solidity
// 1. Merit-only minting
invariant MeritOnlyMinting:
    forall mint event M:
        hasRole(M.caller, MINTER_ROLE) &&
        (M.caller == Claims || M.caller == CommunityFactory)

// 2. No token purchases
invariant NoTokenPurchases:
    not exists function buyTokens(uint256 ethAmount)

// 3. Delegation chain validity
invariant DelegationChainValid:
    forall address A:
        not exists cycle in delegationChain(A)  // No circular delegation

// 4. Historical voting power consistency
invariant HistoricalVotingPowerConsistency:
    forall address A, block B1, block B2 where B1 < B2:
        noDelegationChanges(A, B1, B2) && noTransfers(A, B1, B2) =>
        getPastVotes(A, B1) == getPastVotes(A, B2)
```

**Integration Invariants**:

```solidity
// 1. Parameter updates require governance
invariant ParameterGovernanceGated:
    forall contract C, function updateParameter():
        hasModifier(updateParameter, onlyRole(GOVERNANCE_ROLE))

// 2. Multi-choice configuration consistency
invariant MultiChoiceConfigConsistency:
    forall proposal P where isMultiChoice(P):
        _multiConfigs[P].numOptions == _numOptions[P] &&
        _multiConfigs[P].optionTotals.length == _numOptions[P]

// 3. Role assignment protection
invariant RoleAssignmentProtected:
    forall role R where R == GOVERNANCE_ROLE:
        hasRole(timelock, R) &&
        not exists address A where A != timelock && hasRole(A, R)
```

## 6. Integration Points

### External Contracts Depending on Governance Core

| Contract | Dependency | Functions Expected | Timing Assumptions |
|----------|-----------|-------------------|-------------------|
| **TimelockController** | ShiftGovernor | `schedule()`, `execute()`, `cancel()` | Min delay 48h (configurable) |
| **ParamController** | ShiftGovernor + Timelock | `updateParameter()` | Voting delay 1d + voting period 5d + timelock 48h |
| **ValuableActionRegistry** | Timelock | `createAction()`, `updateAction()`, `activateAction()` | Standard governance timing |
| **TreasuryAdapter** | Timelock | `updateSpendingLimit()`, `emergencyWithdraw()` | Standard governance timing |
| **RevenueRouter** | Timelock | `updateSplit()`, `updateInvestorROI()` | Standard governance timing |
| **CommunityToken** | Timelock | `updateBackingAssets()`, `updateFeeOnWithdraw()` | Standard governance timing |
| **VerifierElection** | Timelock | `grantVerifierPower()`, `revokeVerifier()`, `slashVerifier()` | Standard governance timing |
| **Claims** | MembershipToken | `mint()` for approved claims | Immediate (no delay) |
| **CommunityFactory** | MembershipToken | `batchMint()` for founder allocation | Immediate during deployment |
| **RequestHub** | Governance | `setModerator()`, `freezeRequest()` | Standard governance timing |
| **DraftsManager** | ShiftGovernor | `escalateToProposal()` returns proposalId | Voting delay 1d |

### TimelockController Integration

**Role Configuration**:

```solidity
// Timelock roles assigned during deployment
timelock.grantRole(PROPOSER_ROLE, address(governor));  // Governor can queue proposals
timelock.grantRole(EXECUTOR_ROLE, address(0));         // Anyone can execute after delay
timelock.grantRole(CANCELLER_ROLE, address(governor)); // Governor can cancel malicious proposals
timelock.grantRole(TIMELOCK_ADMIN_ROLE, address(timelock)); // Self-administered
```

**Functions Governor Calls**:

```solidity
// Queue proposal for execution (after voting succeeds)
function schedule(
    address target,
    uint256 value,
    bytes calldata data,
    bytes32 predecessor,
    bytes32 salt,
    uint256 delay
) external onlyRole(PROPOSER_ROLE)

// Execute queued proposal (after delay expires)
function execute(
    address target,
    uint256 value,
    bytes calldata payload,
    bytes32 predecessor,
    bytes32 salt
) external payable onlyRole(EXECUTOR_ROLE)

// Cancel malicious proposal (during delay period)
function cancel(bytes32 id) external onlyRole(CANCELLER_ROLE)
```

**Timing Assumptions**:

- **Minimum Delay**: 48 hours (configurable, but cannot be zero)
- **Delay Updates**: Require governance proposal (self-referential)
- **Execution Window**: Proposals expire if not executed within grace period

### ParamController Integration

**Governance-Controlled Parameters**:

```solidity
// ParamController stores all community configuration
struct CommunityParams {
    // Governance timing
    uint256 votingDelay;
    uint256 votingPeriod;
    uint256 proposalThreshold;
    uint256 quorumPercentage;

    // Economic parameters
    uint256[3] revenueSplit;  // [workers%, treasury%, investors%]
    uint256 feeOnWithdraw;

    // Verification parameters
    uint256 minJurors;
    uint256 maxConcurrentClaims;
}

// Only callable via governance
function updateParameter(
    uint256 communityId,
    bytes32 paramKey,
    uint256 newValue
) external onlyRole(GOVERNANCE_ROLE) {
    require(msg.sender == timelock, "Only through governance");
    communityParams[communityId][paramKey] = newValue;
    emit ParameterUpdated(communityId, paramKey, newValue);
}
```

**Integration Flow**:

1. Community discusses parameter change in RequestHub
2. Draft proposal created in DraftsManager
3. Draft escalated to Governor proposal
4. Proposal voting (5 days)
5. Queue in timelock (48 hour delay)
6. Execute: Timelock calls `ParamController.updateParameter()`
7. New parameter value active immediately

### Claims & MembershipToken Integration

**Token Minting on Claim Approval**:

```solidity
// Claims contract mints governance tokens when work verified
contract Claims {
    MembershipTokenERC20Votes public membershipToken;
    ValuableActionRegistry public actionRegistry;

    function approveClaim(uint256 claimId) external {
        // VPS verification already complete (M-of-N jurors approved)

        Claim storage claim = claims[claimId];
        ValuableAction memory action = actionRegistry.getAction(claim.actionId);

        // State change
        claim.state = ClaimState.Approved;

        // Mint governance tokens (immediate, no delay)
        membershipToken.mint(
            claim.worker,
            action.membershipTokenReward,
            string(abi.encodePacked("Claim #", claimId, " verified"))
        );

        // Mint reputation SBT
        valuableActionSBT.mint(claim.worker, action.id, action.workerPointsReward);

        emit ClaimApproved(claimId, claim.worker, action.membershipTokenReward);
    }
}
```

**Assumptions**:

- Claims contract has MINTER_ROLE on MembershipToken
- Token minting is immediate (no governance delay for verified work)
- Minting reasons logged for transparency

### Other Module Integrations

**TreasuryAdapter**:

```solidity
// Governance controls spending limits
function updateSpendingLimit(uint256 newLimit) external onlyRole(GOVERNANCE_ROLE) {
    maxSpendingPerPeriod = newLimit;
}

// Timing: Standard governance (1d delay + 5d vote + 48h timelock)
```

**VerifierElection**:

```solidity
// Governance manages verifier sets
function grantVerifierPower(
    uint256 communityId,
    address verifier,
    uint256 power,
    string calldata reason
) external onlyRole(GOVERNANCE_ROLE) {
    verifierPowerToken.mint(verifier, communityId, power, reason);
}

// Timing: Standard governance
```

**RequestHub & DraftsManager**:

```solidity
// Governance can override moderator decisions
function overrideModerator(uint256 requestId, Status newStatus) external onlyRole(GOVERNANCE_ROLE)

// Draft escalation creates Governor proposal
function escalateToProposal(uint256 draftId) external returns (uint256 proposalId) {
    proposalId = governor.propose(...);
}
```

## 7. Testing Considerations

### Proposal Lifecycle Testing

**What Must Be Tested**:

- ✅ **Proposal Creation**:
  - Proposer with sufficient voting power can create proposals
  - Proposer with insufficient power is rejected
  - Multi-choice proposals require numOptions ≥ 2
  - Proposal snapshot correctly locked at creation block

- ✅ **Voting Delay**:
  - Cannot vote during delay period (proposal state = Pending)
  - Voting opens after delay period ends (state = Active)
  - Flash governance attack prevention (snapshot before voting starts)

- ✅ **Voting Period**:
  - Can vote during active period
  - Cannot vote after voting period ends
  - Vote weights correctly read from snapshot block
  - Double voting prevention

- ✅ **Proposal Queuing**:
  - Can queue only if quorum reached and majority approved
  - Cannot queue defeated proposals
  - Timelock correctly records execution time

- ✅ **Proposal Execution**:
  - Can execute only after timelock delay
  - Cannot execute before delay expires
  - Execution calls target contracts with correct calldata
  - State transitions to Executed

- ✅ **Proposal Cancellation**:
  - Proposer can cancel if voting power drops below threshold
  - Governance can cancel malicious proposals
  - Cannot cancel already executed proposals

### Multi-Choice Voting Edge Cases

**Edge Cases to Test**:

1. **Zero Votes Scenario**:
   ```solidity
   // All voters abstain or distribute 0% weight
   weights = [0, 0, 0, 0];
   // Expected: No winning option, proposal defeated
   ```

2. **Tie Scenario**:
   ```solidity
   // Two options receive equal weight
   // Voter A: [500, 500, 0, 0]
   // Voter B: [500, 500, 0, 0]
   // Expected: First option (index 0) wins by default
   ```

3. **Multiple Winning Options**:
   ```solidity
   // Complex preference distribution
   // Voter A: [400, 300, 200, 100]
   // Voter B: [100, 200, 300, 400]
   // Expected: Sum per option, highest wins
   ```

4. **Partial Weight Distribution**:
   ```solidity
   // Voter only distributes 70% of weight
   weights = [0.5e18, 0.2e18, 0, 0]; // 70% total
   // Expected: Valid vote, 30% effectively abstained
   ```

5. **Single Option Support**:
   ```solidity
   // Voter gives 100% to one option
   weights = [1e18, 0, 0, 0];
   // Expected: Valid vote, equivalent to binary "For"
   ```

6. **Weight Precision**:
   ```solidity
   // Voter uses maximum precision
   weights = [333333333333333333, 333333333333333333, 333333333333333334, 0];
   // Expected: Sum = 1e18 exactly, valid vote
   ```

7. **No Quorum**:
   ```solidity
   // Only 1% of token holders vote
   // Expected: Proposal defeated (quorum not reached)
   ```

### Delegation Testing

**Critical Delegation Scenarios**:

- ✅ **Self-Delegation**:
  - User delegates to self → voting power activated
  - Can vote with full token balance

- ✅ **Delegation to Others**:
  - User A delegates to User B → User B gains A's voting power
  - User A cannot vote (power delegated away)

- ✅ **Delegation Chain**:
  - A delegates to B, B delegates to C → C has A+B+C power
  - Chain updates on any delegation change

- ✅ **Cycle Detection**:
  - A delegates to B, B delegates to A → prevented or handled gracefully
  - No infinite loops in delegation chains

- ✅ **Delegation After Snapshot**:
  - Proposal created at block 100
  - User delegates at block 105
  - Vote at block 110 uses delegation state at block 100
  - New delegation doesn't affect old proposals

- ✅ **Delegation Revocation**:
  - User delegates to expert
  - User later self-delegates (revokes delegation)
  - Expert's voting power correctly decreases

### Integration Tests

**Cross-Module Governance Tests**:

1. **Parameter Update Flow**:
   ```solidity
   // End-to-end test: Change voting period via governance
   function testParameterUpdateFlow() {
       // 1. Create proposal to update voting period
       uint256 proposalId = governor.propose(
           [address(paramController)],
           [0],
           [abi.encodeCall(paramController.updateParameter, (communityId, "votingPeriod", 7 days))],
           "Extend voting period to 7 days"
       );

       // 2. Advance through voting delay
       vm.roll(block.number + 7200); // 1 day

       // 3. Cast votes
       governor.castVote(proposalId, 1); // For

       // 4. Advance through voting period
       vm.roll(block.number + 50400); // 7 days

       // 5. Queue in timelock
       governor.queue(...);

       // 6. Advance through timelock delay
       vm.warp(block.timestamp + 2 days);

       // 7. Execute
       governor.execute(...);

       // 8. Verify parameter updated
       assertEq(paramController.votingPeriod(communityId), 7 days);
   }
   ```

2. **Claims → MembershipToken Minting**:
   ```solidity
   function testClaimApprovalMintsTokens() {
       // Setup: Create ValuableAction with token reward
       // File claim
       // VPS verification approves claim
       // Verify: Worker received membershipTokenReward
       // Verify: Worker's voting power increased
   }
   ```

3. **Multi-Module Proposal**:
   ```solidity
   function testMultiTargetProposal() {
       // Proposal calls multiple contracts atomically
       targets = [paramController, treasuryAdapter, revenueRouter];
       // Verify: All execute or all revert (atomicity)
   }
   ```

### Fuzz Testing Targets

**Property-Based Testing Ideas**:

1. **Vote Weight Distribution**:
   ```solidity
   function testFuzz_VoteWeightDistribution(uint256[] memory weights) public {
       // Property: sum(weights) <= 1e18 or vote reverts
       // Property: Individual weights <= 1e18 or vote reverts
       // Property: Final option totals sum to total voting power used
   }
   ```

2. **Delegation Chains**:
   ```solidity
   function testFuzz_DelegationChains(address[] memory delegators, address[] memory delegatees) public {
       // Property: No delegation cycles
       // Property: Sum of all voting power == total supply
       // Property: Delegation chain depth <= reasonable limit
   }
   ```

3. **Proposal States**:
   ```solidity
   function testFuzz_ProposalStateTransitions(uint256 proposalId, uint256 timeElapsed) public {
       // Property: Valid state transitions only
       // Property: Cannot execute before timelock delay
       // Property: Cannot vote after voting period ends
   }
   ```

4. **Quorum Calculations**:
   ```solidity
   function testFuzz_QuorumCalculations(uint256 totalSupply, uint256 quorumPercentage) public {
       // Property: quorum(P) == (totalSupply * quorumPercentage) / 100
       // Property: quorum never exceeds total supply
       // Property: quorum updates correctly when supply changes
   }
   ```

5. **Multi-Choice Result Calculation**:
   ```solidity
   function testFuzz_MultiChoiceResults(
       uint256[] memory voterPowers,
       uint256[][] memory voterWeights
   ) public {
       // Property: Winning option has highest total weight
       // Property: Total weight == sum of all voter powers used
       // Property: Results deterministic given inputs
   }
   ```

### Coverage Requirements

**Minimum Coverage Targets**:

- ✅ **Line Coverage**: ≥86% (enforced by CI)
- ✅ **Branch Coverage**: ≥80% (all decision paths tested)
- ✅ **Function Coverage**: 100% (all public/external functions tested)
- ✅ **Integration Coverage**: All cross-contract calls tested end-to-end

**Critical Paths Requiring 100% Coverage**:

- Proposal execution flow (create → vote → queue → execute)
- Vote counting logic (binary and multi-choice)
- Delegation mechanism (delegate, snapshot, voting power calculation)
- Access control (only timelock can execute governance functions)
- Token minting (only authorized contracts can mint)
- Timelock security (delay enforcement, cancellation)

---

**The Governance Core provides production-ready democratic decision-making infrastructure where voting power is earned through verified contributions rather than purchased, enabling Shift DeSoc communities to make nuanced, secure, and transparent governance decisions with built-in protections against economic attacks and governance capture.**
