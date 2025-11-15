# CountingMultiChoice Contract

The CountingMultiChoice contract implements the core voting logic for Shift DeSoc's innovative multi-choice governance system. It extends traditional binary voting with weighted preference distribution, enabling nuanced community decision-making on complex proposals.

## 🎯 Purpose & Role

CountingMultiChoice serves as the **voting calculation engine** that:
- Tracks weighted votes across multiple proposal options
- Maintains vote snapshots for transparent tallying
- Integrates seamlessly with OpenZeppelin Governor architecture
- Provides rich voting analytics for community insights
- Enables sophisticated preference expression beyond binary choices

Think of it as an **advanced ballot counting system** that can handle complex preference voting while maintaining the security and transparency of blockchain-based governance.

## 🏗️ Core Architecture

### Vote Storage Structure
```solidity
struct ProposalVote {
    uint256 againstVotes;           // Traditional "No" votes
    uint256 forVotes;              // Traditional "Yes" votes  
    uint256 abstainVotes;          // Traditional abstentions
    mapping(uint256 => uint256) optionVotes; // Multi-choice vote weights
    mapping(address => bool) hasVoted;       // Voter participation tracking
    mapping(address => uint256[]) voterWeights; // Individual weight distributions
}

mapping(uint256 => ProposalVote) private _proposalVotes;
```

### Multi-Choice Configuration
```solidity
struct MultiChoiceConfig {
    bool enabled;              // Whether multi-choice is active
    uint8 numOptions;         // Number of available options
    uint256 totalWeight;      // Sum of all cast votes
    uint256[] optionTotals;   // Vote total per option
}

mapping(uint256 => MultiChoiceConfig) private _multiConfigs;
```

**Design Philosophy**: The structure supports both traditional binary voting (backward compatibility) and advanced multi-choice voting (new functionality) in a unified system.

## ⚙️ Voting Mechanisms

### Multi-Choice Vote Casting
#### `castVoteMulti(proposalId, voter, weight, weights[], reason)`
**Purpose**: Record a voter's preference distribution across multiple proposal options.

**Voting Process**:
```solidity
function castVoteMulti(
    uint256 proposalId,
    address voter,
    uint256 weight,
    uint256[] calldata weights,
    string calldata reason
) external returns (uint256 weightUsed) {
    // Validation phase
    require(_multiConfigs[proposalId].enabled, "Multi-choice not enabled");
    require(!_proposalVotes[proposalId].hasVoted[voter], "Already voted");
    require(weights.length == _multiConfigs[proposalId].numOptions, "Invalid weight count");
    
    // Weight distribution validation
    uint256 totalDistributed = _sumWeights(weights);
    require(totalDistributed <= 1e18, "Cannot exceed 100%"); // 1e18 = 100% in basis points
    
    // Record vote
    _proposalVotes[proposalId].hasVoted[voter] = true;
    _proposalVotes[proposalId].voterWeights[voter] = weights;
    
    // Apply voter's weight proportionally to each option
    for (uint256 i = 0; i < weights.length; i++) {
        if (weights[i] > 0) {
            uint256 optionWeight = (weight * weights[i]) / 1e18;
            _proposalVotes[proposalId].optionVotes[i] += optionWeight;
            _multiConfigs[proposalId].optionTotals[i] += optionWeight;
        }
    }
    
    _multiConfigs[proposalId].totalWeight += weight;
    
    emit VoteMultiCast(voter, proposalId, weights, reason);
    return totalDistributed;
}
```

**Key Innovation**: Voters can express nuanced preferences like "60% support for Option A, 40% for Option B" rather than being forced into binary choices.

### Weight Distribution Examples

#### Example 1: Strong Preference
```solidity
// Voter strongly prefers Option 1, but accepts Option 2 as backup
weights = [800000000000000000, 200000000000000000, 0, 0]; // 80%, 20%, 0%, 0%
```

#### Example 2: Split Preference  
```solidity
// Voter is genuinely torn between Options 2 and 3
weights = [0, 500000000000000000, 500000000000000000, 0]; // 0%, 50%, 50%, 0%
```

#### Example 3: Distributed Preference
```solidity
// Voter wants to influence all viable options
weights = [400000000000000000, 300000000000000000, 200000000000000000, 100000000000000000]; // 40%, 30%, 20%, 10%
```

### Backward Compatibility (Binary Voting)
```solidity
function _countVote(
    uint256 proposalId,
    address account,
    uint8 support,
    uint256 weight,
    bytes memory // params (unused for binary)
) internal virtual override {
    ProposalVote storage proposalvote = _proposalVotes[proposalId];

    if (proposalvote.hasVoted[account]) {
        revert GovernorAlreadyCastVote(account);
    }
    proposalvote.hasVoted[account] = true;

    if (support == uint8(VoteType.Against)) {
        proposalvote.againstVotes += weight;
    } else if (support == uint8(VoteType.For)) {
        proposalvote.forVotes += weight;
    } else if (support == uint8(VoteType.Abstain)) {
        proposalvote.abstainVotes += weight;
    } else {
        revert GovernorInvalidVoteType();
    }
}
```

**Compatibility**: Standard Governor contracts can continue using binary voting while new proposals can opt into multi-choice functionality.

## 📊 Vote Tallying & Results

### Result Calculation
#### `proposalVotes(uint256 proposalId)`
**Purpose**: Retrieve comprehensive voting results for analysis and decision-making.

**Return Data**:
```solidity
function proposalVotes(uint256 proposalId) public view returns (
    uint256 againstVotes,
    uint256 forVotes,
    uint256 abstainVotes
) {
    ProposalVote storage proposalvote = _proposalVotes[proposalId];
    return (
        proposalvote.againstVotes,
        proposalvote.forVotes, 
        proposalvote.abstainVotes
    );
}
```

### Multi-Choice Results
#### `getOptionVotes(uint256 proposalId, uint256 optionIndex)`
**Purpose**: Get vote weight for specific proposal option.

```solidity
function getOptionVotes(uint256 proposalId, uint256 optionIndex) 
    external view returns (uint256) {
    require(optionIndex < _multiConfigs[proposalId].numOptions, "Invalid option");
    return _proposalVotes[proposalId].optionVotes[optionIndex];
}
```

#### `getAllOptionVotes(uint256 proposalId)`
**Purpose**: Retrieve complete vote distribution across all options.

```solidity
function getAllOptionVotes(uint256 proposalId) 
    external view returns (uint256[] memory) {
    uint8 numOptions = _multiConfigs[proposalId].numOptions;
    uint256[] memory votes = new uint256[](numOptions);
    
    for (uint256 i = 0; i < numOptions; i++) {
        votes[i] = _proposalVotes[proposalId].optionVotes[i];
    }
    
    return votes;
}
```

### Winner Determination
```solidity
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

**Democratic Outcome**: The option with the most weighted votes wins, reflecting the community's distributed preferences.

## 🔧 Configuration Management

### Multi-Choice Activation
#### `enableMulti(uint256 proposalId, uint8 numOptions)`
**Purpose**: Configure a proposal for multi-choice voting.

```solidity
function enableMulti(uint256 proposalId, uint8 numOptions) external onlyGovernor {
    require(numOptions >= 2, "Need at least 2 options");
    require(numOptions <= 10, "Too many options"); // Practical UI limit
    require(!_multiConfigs[proposalId].enabled, "Already enabled");
    
    _multiConfigs[proposalId] = MultiChoiceConfig({
        enabled: true,
        numOptions: numOptions,
        totalWeight: 0,
        optionTotals: new uint256[](numOptions)
    });
    
    emit MultiChoiceEnabled(proposalId, numOptions);
}
```

**Flexibility**: Each proposal can have a different number of options (2-10) based on the complexity of the decision.

### Proposal Cleanup
#### `cancelProposal(uint256 proposalId)`
**Purpose**: Clean up multi-choice state when proposals are cancelled.

```solidity
function cancelProposal(uint256 proposalId) external onlyGovernor {
    delete _multiConfigs[proposalId];
    // Note: Individual vote records preserved for transparency
    
    emit ProposalCanceled(proposalId);
}
```

## 🛡️ Security & Validation

### Input Validation
```solidity
function _sumWeights(uint256[] calldata weights) internal pure returns (uint256 total) {
    for (uint256 i = 0; i < weights.length; i++) {
        total += weights[i];
    }
}

function _validateWeights(uint256[] calldata weights, uint8 numOptions) internal pure {
    require(weights.length == numOptions, "Weight array length mismatch");
    
    uint256 totalWeight = _sumWeights(weights);
    require(totalWeight <= 1e18, "Total weights exceed 100%");
    
    // Individual weight validation
    for (uint256 i = 0; i < weights.length; i++) {
        require(weights[i] <= 1e18, "Individual weight exceeds 100%");
    }
}
```

### Double-Voting Prevention
```solidity
mapping(uint256 => mapping(address => bool)) hasVoted;

modifier onlyOncePerProposal(uint256 proposalId, address voter) {
    require(!_proposalVotes[proposalId].hasVoted[voter], "Already voted");
    _;
}
```

### Access Control
```solidity
modifier onlyGovernor() {
    require(msg.sender == governor, "Only Governor can call");
    _;
}
```

**Security Model**: Only the Governor contract can manage multi-choice configurations, ensuring governance oversight of voting mechanisms.

## 📈 Analytics & Insights

### Voter Analysis
#### `getVoterDistribution(uint256 proposalId, address voter)`
**Purpose**: Retrieve how a specific voter distributed their weight.

```solidity
function getVoterDistribution(uint256 proposalId, address voter) 
    external view returns (uint256[] memory distribution) {
    return _proposalVotes[proposalId].voterWeights[voter];
}
```

**Use Cases**:
- Transparency in voting patterns
- Community analysis of preferences
- Delegation decision support
- Academic research on governance

### Participation Metrics
```solidity
function getParticipationStats(uint256 proposalId) external view returns (
    uint256 totalVoters,
    uint256 totalWeight,
    uint256 averageDistribution
) {
    MultiChoiceConfig storage config = _multiConfigs[proposalId];
    
    // Count unique voters
    uint256 voterCount = 0;
    // Implementation would iterate through hasVoted mapping
    
    return (
        voterCount,
        config.totalWeight,
        config.totalWeight / voterCount
    );
}
```

### Option Performance
```solidity
function getOptionPerformance(uint256 proposalId) external view returns (
    uint256[] memory votes,
    uint256[] memory percentages
) {
    uint8 numOptions = _multiConfigs[proposalId].numOptions;
    uint256 totalWeight = _multiConfigs[proposalId].totalWeight;
    
    votes = new uint256[](numOptions);
    percentages = new uint256[](numOptions);
    
    for (uint256 i = 0; i < numOptions; i++) {
        votes[i] = _proposalVotes[proposalId].optionVotes[i];
        percentages[i] = totalWeight > 0 ? (votes[i] * 10000) / totalWeight : 0;
    }
    
    return (votes, percentages);
}
```

## 🎨 User Experience Features

### Vote Preview
Before casting votes, users can preview their distribution:
```solidity
function previewVoteDistribution(
    uint256 voterWeight,
    uint256[] calldata weights
) external pure returns (uint256[] memory actualWeights) {
    actualWeights = new uint256[](weights.length);
    
    for (uint256 i = 0; i < weights.length; i++) {
        actualWeights[i] = (voterWeight * weights[i]) / 1e18;
    }
    
    return actualWeights;
}
```

### Vote Validation
```solidity
function validateVoteDistribution(uint256[] calldata weights) 
    external pure returns (bool valid, string memory reason) {
    
    uint256 total = _sumWeights(weights);
    
    if (total > 1e18) {
        return (false, "Total exceeds 100%");
    }
    
    if (total == 0) {
        return (false, "Must allocate some weight");
    }
    
    return (true, "Valid distribution");
}
```

## 🔮 Advanced Features

### Conditional Voting
Future enhancement for complex preferences:
```solidity
// "If Option A fails, then my votes go to Option B"
struct ConditionalVote {
    uint256[] primaryWeights;
    uint256[] fallbackWeights;
    uint256 threshold;
}
```

### Ranked Choice Integration
Potential upgrade path:
```solidity
// "Rank options 1, 2, 3, 4 and eliminate lowest until majority"
struct RankedVote {
    uint256[] rankings;
    bool eliminationRound;
}
```

---

The CountingMultiChoice contract enables sophisticated democratic decision-making that reflects the nuanced nature of community governance while maintaining the security, transparency, and verifiability that blockchain governance systems require. Its integration with the broader Shift DeSoc ecosystem creates a powerful platform for complex community coordination.