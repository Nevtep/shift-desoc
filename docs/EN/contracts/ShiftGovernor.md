# ShiftGovernor Contract

ShiftGovernor is Shift DeSoc's production-ready governance contract that extends OpenZeppelin's Governor with multi-choice voting capabilities. It provides both traditional binary voting and innovative multi-option preference voting for nuanced community decision-making.

## 🎯 Purpose & Role

ShiftGovernor serves as the **democratic decision-making engine** of Shift DeSoc communities by:

- Managing proposal creation, voting, and secure execution through timelock
- Supporting both binary (yes/no) and multi-choice (preference distribution) voting
- Integrating seamlessly with CountingMultiChoice for advanced vote tallying
- Coordinating with MembershipTokenERC20Votes for merit-based voting power
- Providing clean interfaces for frontend governance applications

**Production Focus**: Delivers essential governance functionality with proven OpenZeppelin security foundations rather than experimental features.

## 🏗️ Core Architecture

### Dual Voting System

ShiftGovernor supports two voting modes within the same governance infrastructure:

**Binary Voting** (Traditional):

```solidity
// Standard OpenZeppelin Governor voting
function castVote(uint256 proposalId, uint8 support) external
// support: 0=Against, 1=For, 2=Abstain
```

**Multi-Choice Voting** (Innovation):

```solidity
// Distribute voting power across multiple options
function castVoteMultiChoice(
    uint256 proposalId,
    uint256[] calldata weights,
    string calldata reason
) external
```

### Multi-Choice Implementation

#### Proposal Creation

```solidity
function proposeMultiChoice(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas,
    string memory description,
    uint8 numOptions
) public returns (uint256 proposalId) {
    proposalId = propose(targets, values, calldatas, description);
    _numOptions[proposalId] = numOptions;

    if (multiCounter != address(0)) {
        ICountingMultiChoice(multiCounter).enableMulti(proposalId, numOptions);
    }
}
```

**Key Features**:

- Extends standard OpenZeppelin proposals with multi-option capability
- Maintains full compatibility with existing Governor infrastructure
- Clean separation between proposal creation and vote counting

## ⚙️ Governance Workflow

### 1. Proposal Lifecycle

```solidity
// Binary proposal (inherited from OpenZeppelin)
uint256 proposalId = propose(targets, values, calldatas, "Simple decision");

// Multi-choice proposal (Shift innovation)
uint256 multiId = proposeMultiChoice(
    targets, values, calldatas,
    "Complex decision with options",
    4  // Number of voting options
);
```

### 2. Voting Process

**Binary Voting**:

```solidity
// Standard OpenZeppelin voting
castVote(proposalId, 1); // For
castVote(proposalId, 0); // Against
castVote(proposalId, 2); // Abstain
```

**Multi-Choice Voting**:

```solidity
// Distribute 100% of voting power across options
uint256[] memory weights = new uint256[](4);
weights[0] = 0.5e18;  // 50% to Option A
weights[1] = 0.3e18;  // 30% to Option B
weights[2] = 0.2e18;  // 20% to Option C
weights[3] = 0;       // 0% to Option D

castVoteMultiChoice(proposalId, weights, "My reasoning");
```

### 3. Execution & Security

**Timelock Integration**:

```solidity
// All proposals execute through timelock for security
function _executor() internal view override returns (address) {
    return address(timelock);
}
```

**Execution Flow**: `Vote Passes → Timelock Queue → Delay Period → Execute`

**Security Benefits**: Timelock delay allows community to review and potentially cancel malicious proposals even after they pass voting.

## 🗳️ Voting System

### Multi-Choice Voting Implementation

The core innovation is `castVoteMultiChoice()` which allows preference distribution:

```solidity
function castVoteMultiChoice(
    uint256 proposalId,
    uint256[] calldata weights,
    string calldata reason
) external {
    // Validation
    if (multiCounter == address(0)) revert Errors.MultiChoiceNotEnabled(proposalId);
    if (state(proposalId) != ProposalState.Active) revert Errors.ProposalNotActive(proposalId, uint8(state(proposalId)));

    // Get voter's power from MembershipToken
    uint256 weight = getVotes(_msgSender(), proposalSnapshot(proposalId));
    if (weight == 0) revert Errors.InsufficientVotingPower(_msgSender(), 1, 0);

    // Cast vote via CountingMultiChoice
    uint256 weightUsed = ICountingMultiChoice(multiCounter).castVoteMulti(
        proposalId, _msgSender(), weight, weights, reason
    );

    emit MultiChoiceVoteCast(proposalId, _msgSender(), weights, weightUsed, reason);
}
```

### Voting Power Source

**Merit-Based Voting**: Voting power comes from MembershipTokenERC20Votes, which is minted through verified work contributions rather than purchased.

**Delegation Support**: Full OpenZeppelin delegation support allows liquid democracy where token holders can delegate to trusted experts.

### Vote Counting Integration

ShiftGovernor delegates actual vote counting to CountingMultiChoice contract, maintaining clean separation of concerns:

- **ShiftGovernor**: Proposal lifecycle, security, OpenZeppelin compatibility
- **CountingMultiChoice**: Vote tallying, weight distribution, result calculation

## 🔧 Configuration & Parameters

### Constructor Parameters

```solidity
constructor(address token, address timelock)
    Governor("ShiftGovernor")
    GovernorSettings(1 days, 5 days, 0)  // votingDelay, votingPeriod, proposalThreshold
    GovernorVotes(IVotes(token))          // MembershipTokenERC20Votes
    Quorum(4)                             // 4% quorum
    GovernorTimelockControl(TimelockController(payable(timelock)))
{}
```

### Current Settings

- **Voting Delay**: 1 day (prevents flash governance attacks)
- **Voting Period**: 5 days (sufficient time for participation)
- **Proposal Threshold**: 0 (inclusive participation)
- **Quorum**: 4% of total token supply
- **Timelock Integration**: All proposals execute through timelock

### Multi-Choice State

```solidity
mapping(uint256 => uint8) private _numOptions;  // Tracks options per proposal
address public multiCounter;                    // CountingMultiChoice address
```

### Runtime Configuration

```solidity
// Can only be changed by governance
function setCountingMulti(address counter) external onlyGovernance

// One-time initialization during deployment
function initCountingMulti(address counter) external
```

## 🛡️ Security Features

### Access Control

```solidity
// Only governance can update the multi-choice counter
function setCountingMulti(address counter) external onlyGovernance

// One-time initialization to prevent unauthorized changes
function initCountingMulti(address counter) external {
    require(multiCounter == address(0), "Already initialized");
}
```

### Input Validation

```solidity
// Multi-choice proposals must have at least 2 options
function proposeMultiChoice(..., uint8 numOptions) public returns (uint256) {
    if (numOptions < 2) revert Errors.InvalidOptionsCount(numOptions);
}

// Voting requires active proposal and voting power
function castVoteMultiChoice(...) external {
    if (multiCounter == address(0)) revert Errors.MultiChoiceNotEnabled(proposalId);
    if (state(proposalId) != ProposalState.Active) revert Errors.ProposalNotActive(proposalId, uint8(state(proposalId)));

    uint256 weight = getVotes(_msgSender(), proposalSnapshot(proposalId));
    if (weight == 0) revert Errors.InsufficientVotingPower(_msgSender(), 1, 0);
}
```

### Inherited Security

- **Snapshot-based voting**: Prevents vote manipulation after proposal creation
- **Timelock execution**: Delays provide security against malicious proposals
- **OpenZeppelin proven patterns**: Built on battle-tested governance infrastructure
- **Custom error handling**: Clear error messages for debugging and user experience

## 📊 Frontend Integration

### Essential Getters

```solidity
// Check if proposal supports multi-choice
function isMultiChoice(uint256 proposalId) external view returns (bool)
function numOptionsOf(uint256 proposalId) external view returns (uint8)

// Get voting results
function getMultiChoiceTotals(uint256 proposalId) external view returns (uint256[] memory)
function getVoterMultiChoiceWeights(uint256 proposalId, address voter) external view returns (uint256[] memory)
```

### Event Tracking

```solidity
event MultiChoiceProposalCreated(uint256 indexed proposalId, address indexed proposer, uint8 numOptions, string description);
event MultiChoiceVoteCast(uint256 indexed proposalId, address indexed voter, uint256[] weights, uint256 totalWeight, string reason);
event MultiCounterUpdated(address indexed oldCounter, address indexed newCounter);
```

### Data Access Patterns

- **Proposal Discovery**: Use `isMultiChoice()` to determine UI rendering approach
- **Vote Tallying**: `getMultiChoiceTotals()` provides real-time results for each option
- **User History**: `getVoterMultiChoiceWeights()` shows how individual users voted
- **Event Logs**: Standard Governor events plus multi-choice specific events for complete audit trail

## � Integration Architecture

### CountingMultiChoice Integration

```solidity
// ShiftGovernor delegates vote counting to specialized contract
function castVoteMultiChoice(...) external {
    uint256 weightUsed = ICountingMultiChoice(multiCounter).castVoteMulti(
        proposalId, _msgSender(), weight, weights, reason
    );
}
```

### MembershipToken Integration

```solidity
// Voting power derived from merit-based tokens, not purchased tokens
function getVotes(address account, uint256 blockNumber) public view returns (uint256) {
    return IVotes(token).getPastVotes(account, blockNumber);
}
```

### Timelock Integration

```solidity
// All governance execution goes through timelock
function _executor() internal view override returns (address) {
    return super._executor(); // Returns timelock address
}
```

**Clean Separation**: Each contract has focused responsibilities:

- **ShiftGovernor**: Proposal lifecycle and OpenZeppelin compatibility
- **CountingMultiChoice**: Vote tallying and multi-option logic
- **MembershipToken**: Merit-based voting power distribution
- **TimelockController**: Secure execution with delays

## � Usage Examples

### Binary Proposal (Traditional)

```solidity
// Community creates simple yes/no proposal
uint256 proposalId = propose(
    [treasuryAddress],           // target
    [1000e6],                   // 1000 USDC
    [encodedTransferCall],      // calldata
    "Fund community event"      // description
);

// Members vote normally
castVote(proposalId, 1); // For
```

### Multi-Choice Proposal (Innovation)

```solidity
// Community creates nuanced proposal with options
uint256 multiId = proposeMultiChoice(
    [treasuryAddress],
    [5000e6],
    [encodedTransferCall],
    "Allocate development budget: Option A=Full feature, Option B=MVP, Option C=Research phase, Option D=Delay",
    4  // 4 options
);

// Members distribute their voting power
uint256[] memory weights = new uint256[](4);
weights[0] = 0.6e18;  // 60% prefer full feature
weights[1] = 0.3e18;  // 30% backup: MVP
weights[2] = 0.1e18;  // 10% backup: research
weights[3] = 0;       // 0% for delay

castVoteMultiChoice(multiId, weights, "Prefer ambitious approach with fallback options");
```

**Production Ready**: ShiftGovernor provides essential multi-choice governance functionality with proven OpenZeppelin security patterns, enabling communities to make nuanced decisions while maintaining democratic legitimacy and execution safety.

---

_This documentation reflects the actual implementation rather than theoretical capabilities, ensuring developers can build reliable governance applications on the production-ready Shift DeSoc infrastructure._
