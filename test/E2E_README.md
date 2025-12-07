# End-to-End Testing Guide for Base Sepolia Deployment

This directory contains comprehensive E2E tests that interact with the actual deployed Shift DeSoc contracts on Base Sepolia testnet.

## 🎯 Test Coverage

### **Governance Workflow Tests**

Tests the complete `Request → Draft → Proposal → Vote → Execute` pipeline:

1. **Request Creation** - Community members post requests for changes/features
2. **Draft Development** - Collaborative proposal development with multiple contributors
3. **Community Review** - Draft review and refinement process
4. **Governance Escalation** - Draft escalation to formal governance proposal
5. **Voting Process** - Multi-user voting with different preferences
6. **Execution** - Timelock execution and parameter updates

### **Work Verification Workflow Tests**

Tests the complete `Define Action → Claim → Verify → Reward` pipeline:

1. **Action Definition** - Community defines valuable work types with verification parameters
2. **Verifier Registration** - Users register as verifiers with bonding requirements
3. **Claim Submission** - Workers submit claims for completed work with evidence
4. **M-of-N Verification** - Multiple verifiers review and vote on claim validity
5. **Reward Distribution** - Automatic distribution of governance tokens and SBTs

### **Integration Tests**

Tests interaction between governance and work verification systems:

- Governance proposals that create new action types
- Work verification using governance-created actions
- Cross-system parameter updates and configuration

## 📋 Deployed Contract Addresses (Base Sepolia)

### Master Infrastructure

- **CommunityRegistry**: `0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B`
- **CountingMultiChoice**: `0x9a254605ccEf5c69Ce51b0a8C0a65016dD476c83`

### Community ID 1 Contracts

- **ShiftGovernor**: `0x42362f0f2Cdd96902848e21d878927234C5C9425`
- **TimelockController**: `0xF140d690BadDf50C3a1006AD587298Eed61ADCfA`
- **MembershipTokenERC20Votes**: `0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb`
- **ValuableActionRegistry**: `0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2`
- **Claims**: `0xcd3fEfEE2dd2F3114742893f86D269740DF68B35`
- **VerifierPool**: `0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B`
- **WorkerSBT**: `0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562`
- **RequestHub**: `0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA`
- **DraftsManager**: `0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07`
- **CommunityToken**: `0x9352b89B39D7b0e6255935A8053Df37393013371`

## 🛠️ Running the Tests

### Prerequisites

1. **Base Sepolia RPC Access** - Get RPC endpoint from [Base docs](https://docs.base.org/guides/run-a-base-node)
2. **Test ETH** - Get Base Sepolia ETH from [Base faucet](https://bridge.base.org/deposit)
3. **Environment Variables** - Set up your `.env` file

### Environment Setup

```bash
# .env file
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"  # or your RPC provider
PRIVATE_KEY="your-test-private-key"               # Account with Base Sepolia ETH
```

### Running Foundry Tests (Solidity)

```bash
# Run all E2E tests
forge test --match-contract E2EBaseSepolia --fork-url $BASE_SEPOLIA_RPC_URL -vvv

# Run specific workflow test
forge test --match-test testGovernanceWorkflow --fork-url $BASE_SEPOLIA_RPC_URL -vvv

# Run work verification workflow
forge test --match-test testWorkVerificationWorkflow --fork-url $BASE_SEPOLIA_RPC_URL -vvv

# Run integration tests
forge test --match-test testIntegration --fork-url $BASE_SEPOLIA_RPC_URL -vvv
```

### Running Hardhat Tests (TypeScript)

```bash
# Run all E2E tests
npx hardhat test test/E2EBaseSepolia.test.ts --network base_sepolia

# Run specific test suites
npx hardhat test test/E2EBaseSepolia.test.ts --network base_sepolia --grep "Governance Workflow"
npx hardhat test test/E2EBaseSepolia.test.ts --network base_sepolia --grep "Work Verification"
```

## 🧪 Test Scenarios

### **Scenario 1: Community Parameter Update**

```
User1 → Creates request for debate window update
User2 → Creates draft with governance calldata
Users 3,4 → Collaborate and provide feedback
User2 → Escalates draft to proposal
Users 1-5 → Vote (3 for, 1 against, 1 abstain)
System → Queues and executes via timelock
Result → Community debate window updated to 2 days
```

### **Scenario 2: Code Review Verification**

```
Deployer → Defines "Code Review" action type (50 tokens, M=2, N=3)
Users 2,3,4 → Register as verifiers with 100 token bonds
User1 → Submits code review claim with evidence
Users 2,3 → Approve (quality standards met)
User4 → Rejects (missing security analysis)
System → Approves claim (2/3 majority), distributes 50 tokens + SBT
```

### **Scenario 3: Governance Creates New Action Type**

```
User1 → Requests new "Documentation Review" action type
User2 → Creates draft with ValuableActionRegistry.createAction calldata
Community → Reviews and votes to approve new action type
User1 → Submits claim using newly created action type
Verifiers → Process claim and distribute rewards
```

## 🔍 Test Validation

### **Smart Contract State Verification**

- ✅ Request metadata stored correctly in RequestHub
- ✅ Draft versioning and contributor tracking in DraftsManager
- ✅ Proposal creation and voting in ShiftGovernor
- ✅ Parameter updates applied in CommunityRegistry
- ✅ Action creation and configuration in ValuableActionRegistry
- ✅ Claim status tracking and verification in Claims
- ✅ Verifier bonding and reputation in VerifierPool
- ✅ Token minting and SBT distribution in WorkerSBT/MembershipToken

### **Economic Model Verification**

- ✅ Membership tokens minted on claim approval
- ✅ Worker SBTs issued for verified work
- ✅ Verifier bonds locked during verification
- ✅ Revenue distribution parameters respected
- ✅ Anti-plutocracy mechanisms enforced

### **Governance Integrity**

- ✅ Timelock delays enforced for sensitive operations
- ✅ Quorum requirements met for proposal execution
- ✅ Multi-choice voting weights calculated correctly
- ✅ Delegation and voting power tracking accurate

## 🚨 Known Limitations & Considerations

### **Network Dependencies**

- Tests require Base Sepolia network connectivity
- Gas costs may vary based on network congestion
- Some operations may fail if contracts are paused/upgraded

### **State Dependencies**

- Tests assume contracts are in operational state
- Some tests require deployer permissions for setup
- Existing community state may affect test outcomes

### **Test Isolation**

- Tests may affect each other due to shared contract state
- Consider using different community IDs for parallel testing
- Reset or fork from specific blocks for consistent testing

## 📊 Success Metrics

### **Governance Workflow Success**

- [ ] Request created with correct metadata and status
- [ ] Draft tracks multiple contributors and versions
- [ ] Proposal escalation creates governance proposal with correct parameters
- [ ] Voting proceeds with expected outcomes (3-1-1 split)
- [ ] Execution updates target parameter value
- [ ] All events emitted correctly for off-chain indexing

### **Work Verification Success**

- [ ] Action definition includes all required parameters
- [ ] Verifier registration locks bonds correctly
- [ ] Claim submission creates pending verification
- [ ] M-of-N verification calculates majority correctly
- [ ] Reward distribution mints tokens and SBTs
- [ ] Verifier reputation updated based on accuracy

### **Integration Success**

- [ ] Cross-contract calls execute successfully
- [ ] State consistency maintained across modules
- [ ] Economic incentives align with expected behavior
- [ ] Gas costs remain within reasonable bounds
- [ ] Error handling gracefully manages edge cases

## 🔧 Debugging & Troubleshooting

### **Common Issues**

1. **RPC Connection Failures** - Check Base Sepolia RPC URL and rate limits
2. **Insufficient Gas** - Increase gas limits in hardhat.config.ts
3. **Permission Errors** - Verify deployer account has required roles
4. **Block Timing** - Use consistent block mining for time-dependent tests
5. **State Conflicts** - Use fresh addresses or reset contract state

### **Useful Commands**

```bash
# Check contract verification on BaseScan
npx hardhat verify --network base_sepolia <address> <constructor_args>

# Get current block and time
npx hardhat console --network base_sepolia

# Test specific functions interactively
npx hardhat run scripts/debug-contracts.ts --network base_sepolia
```

---

**📈 Test Status**: Production-ready E2E tests validating complete Shift DeSoc workflows on Base Sepolia testnet.

**🎯 Coverage**: Governance coordination, work verification, economic incentives, and cross-system integration.

**🚀 Next Steps**: Adapt tests for Base mainnet deployment and production community operations.
