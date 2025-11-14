# Shift DeSoc - Smart Contract Development Guide

## Mission: On-Chain Governance Platform for Decentralized Community Work

Shift DeSoc implements fully on-chain governance with multi-choice voting for community decision-making, work verification, and token economy. Core flow: `requests → drafts → proposals → timelock execution` with claims verification and soulbound token rewards.

## Architecture Overview

### Core Governance Stack
- **ShiftGovernor**: OpenZeppelin Governor + multi-choice voting extension
- **CountingMultiChoice**: Custom counting module for weighted multi-option votes
- **TimelockController**: Execution delays for governance decisions
- **MembershipTokenERC20Votes**: Governance token with vote delegation

### Work Verification System
- **ActionTypeRegistry**: Configurable action types with verification parameters
- **VerifierPool**: M-of-N juror selection with bonding and rewards
- **Claims**: Work submission and verification workflow
- **WorkerSBT**: Soulbound tokens minted on approved claims

### Token Economy
- **CommunityToken**: 1:1 USDC-backed stablecoin for payments
- **RevenueRouter**: Configurable revenue splits (50/30/20 default)
- **Marketplace**: Decentralized service marketplace
- **ProjectFactory**: ERC-1155 crowdfunding with milestones

### Additional Modules  
- **DraftsManager**: Proposal creation and escalation workflow
- **HousingManager**: Co-housing reservations (ERC-1155 per night)
- **ParamController**: Centralized parameter management

## Development Workflow

### Dual Toolchain (Hardhat + Foundry)
```bash
# Foundry for testing (primary)
pnpm forge:test -vvv                    # Run all tests with verbose output
pnpm forge:cov                          # Generate coverage report
pnpm cov:gate                          # Enforce ≥86% coverage gate

# Hardhat for deployment
pnpm hh:compile                        # Compile contracts
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia
```

### Testing Strategy
- **Unit tests**: Individual contract functionality in `packages/foundry/test/`
- **Integration tests**: Cross-contract interactions
- **Fuzz tests**: Edge cases and input validation
- **Coverage target**: ≥86% enforced by `scripts/check-coverage.sh`

### Network Deployment Priority
1. **Base Sepolia** (testnet) - Primary development target
2. **Base** (production) - Main deployment target  
3. **Ethereum Sepolia** (testnet) - Secondary target after Base success
4. **Ethereum** (production) - Final deployment after proven on Base

## Smart Contract Patterns

### Multi-Choice Voting Implementation
```solidity
// In ShiftGovernor.sol
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

// In CountingMultiChoice.sol
function castVoteMulti(
    uint256 proposalId,
    address voter,
    uint256 weight,
    uint256[] calldata weights,
    string calldata reason
) external returns (uint256 weightUsed) {
    // weights array must sum ≤ 1e18 (100%)
    require(_sumWeights(weights) <= 1e18, "Invalid weights");
    // Apply voter's weight proportionally to each option
}
```

### Claims Verification Flow
```solidity
// ActionType configuration
struct ActionType {
    uint32 weight;              // WorkerPoints reward
    uint32 jurorsMin;           // M (minimum approvals)
    uint32 panelSize;           // N (total jurors)
    uint32 verifyWindow;        // Time limit for verification
    uint32 cooldown;            // Cooldown between claims
    uint32 rewardVerify;        // Verifier reward points
    uint32 slashVerifierBps;    // Slashing rate for bad verifiers
    bool revocable;             // Can be revoked by governance
    string evidenceSpecCID;     // IPFS evidence requirements
}

// Claims workflow: submit → verify (M-of-N) → approve → mint SBT
```

### Token Economy Patterns
```solidity
// CommunityToken: 1:1 USDC backing
function mint(uint256 usdcAmount) external {
    USDC.transferFrom(msg.sender, address(this), usdcAmount);
    _mint(msg.sender, usdcAmount);
}

function redeem(uint256 tokenAmount) external {
    _burn(msg.sender, tokenAmount);
    USDC.transfer(msg.sender, tokenAmount);
}
```

## Development Guidelines

### Code Standards
- **Solidity**: ^0.8.24 with OpenZeppelin 5.x
- **Gas optimization**: 200 optimizer runs, avoid unbounded loops
- **Security**: CEI pattern, reentrancy guards, input validation
- **Documentation**: Complete NatSpec for all public functions

### Error Handling
```solidity
// Use custom errors from contracts/libs/Errors.sol
error InvalidProposalId(uint256 proposalId);
error InsufficientVotingPower(address voter, uint256 required, uint256 actual);
error VotingPeriodEnded(uint256 proposalId, uint256 deadline);
```

### Testing Patterns
```solidity
// Base test contract pattern
contract TestBase is Test {
    ShiftGovernor governor;
    CountingMultiChoice counting;
    MembershipToken token;
    
    function setUp() public {
        token = new MembershipToken();
        governor = new ShiftGovernor(address(token), address(timelock));
        counting = new CountingMultiChoice();
        governor.setCountingMulti(address(counting));
    }
}
```

## Critical Implementation Tasks

### Phase 1: Core Governance
1. Complete `CountingMultiChoice` with weight snapshots and events
2. Implement `ShiftGovernor` hooks and multi-choice integration
3. Add comprehensive getters for UI integration

### Phase 2: Verification System  
1. `ActionTypeRegistry` with configurable verification parameters
2. `VerifierPool` with pseudo-random juror selection and bonding
3. `Claims` end-to-end workflow with appeal windows
4. `WorkerSBT` with WorkerPoints EMA tracking

### Phase 3: Economic Modules
1. `DraftsManager` with proposal lifecycle tracking
2. `CommunityToken` with 1:1 USDC backing
3. `RevenueRouter` with configurable splits
4. `Marketplace` and `ProjectFactory` basic functionality

### Phase 4: Deployment & Testing
1. Complete deployment scripts for all networks
2. On-chain smoke tests covering full workflows
3. Achieve ≥86% test coverage
4. Base Sepolia deployment and verification

## Quick Start Commands

```bash
# Setup and test
pnpm install
pnpm build                    # Compile both toolchains
pnpm forge:test              # Run Foundry tests
pnpm cov:gate                # Check coverage

# Deploy to testnet
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia

# Format code
pnpm fmt
```

Focus on building robust, well-tested contracts that form the foundation of decentralized community governance and work verification.