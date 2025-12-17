# Shift DeSoc - Architecture Gap Analysis & MVP Implementation Plan

**Analysis Date**: November 16, 2025  
**Current State**: Post-tooling restructure, ready for core implementation

## 🔍 **Current Implementation Status**

### ✅ **Completed Components**

#### **Core Governance Stack**

- ✅ `ShiftGovernor` - OpenZeppelin Governor with multi-choice extension hooks (190 lines)
- ✅ `CountingMultiChoice` - Custom counting module for weighted multi-option votes
- ⚠️ `MembershipTokenERC20Votes` - Exists but needs governance-only minting logic

#### **Community Coordination Layer**

- ✅ `CommunityRegistry` - Community metadata, parameters, module addresses (625 lines)
- ✅ `RequestHub` - Discussion forum foundation
- ✅ `DraftsManager` - Collaborative proposal development
- ✅ `ParamController` - Dynamic parameter management

#### **Work Verification System (Partial)**

- ⚠️ `ActionTypeRegistry` - EXISTS but needs rename to `ValuableActionRegistry` + architecture updates
- ✅ `Claims` - M-of-N verification workflow (492 lines)
- ⚠️ `VerifierPool` - Needs implementation
- ✅ `WorkerSBT` - Soulbound tokens with WorkerPoints EMA (484 lines)

#### **Economic Infrastructure (Partial)**

- ⚠️ `CommunityToken` - EXISTS but needs salary system implementation
- ⚠️ `RevenueRouter` - EXISTS but needs ROI-based decay logic
- ✅ `TreasuryAdapter` - Treasury management
- ✅ Infrastructure modules (`HousingManager`, `Marketplace`, `ProjectFactory`)

### 🚨 **Critical Gaps & Misalignments**

#### **1. Terminology Mismatch**

- **Problem**: Code uses `ActionType` but architecture specifies `ValuableAction`
- **Impact**: Creates confusion, inconsistent with documentation
- **Solution**: Rename `ActionTypeRegistry` → `ValuableActionRegistry`

#### **2. MembershipToken Minting Logic**

- **Problem**: Current implementation allows deployer minting
- **Architecture**: Should only mint from ValuableAction completion via Claims
- **Impact**: Breaks merit-based governance model

#### **3. Missing CommunityFactory**

- **Problem**: No deployment factory for new communities
- **Architecture**: Bootstrap pattern with founder MembershipToken distribution
- **Impact**: Cannot create communities with proper initialization

#### **4. Revenue Distribution Logic**

- **Problem**: RevenueRouter uses time-based decay
- **Architecture**: Should use ROI-based decay where investor share decreases as ROI approaches target
- **Impact**: Incorrect economic incentives

#### **5. CommunityToken Salary System**

- **Problem**: Missing SBT-weighted periodic claims mechanism
- **Architecture**: Merit-based salary distribution with fraud protection
- **Impact**: No sustainable compensation system

#### **6. Missing Integration Points**

- **Problem**: Contracts exist independently without proper integration
- **Architecture**: RequestHub → Claims bounties, DraftsManager → ValuableAction proposals
- **Impact**: System doesn't work as cohesive platform

## 🎯 **MVP Core Requirements**

### **Phase 1: Foundation (Base Governance + Work Verification)**

Must have for Base Sepolia deployment:

1. **Core Governance Flow**:
   - Community creation via CommunityFactory
   - MembershipToken minted only via Claims → WorkerSBT
   - Proposals with multi-choice voting
   - TimelockController execution

2. **Work Verification Flow**:
   - ValuableActionRegistry (renamed) with community-configured parameters
   - Claims submission → M-of-N juror verification → WorkerSBT minting
   - MembershipToken minting on approved claims
   - Basic VerifierPool implementation

3. **Economic Foundation**:
   - CommunityToken with 1:1 USDC backing
   - Basic RevenueRouter with ROI-based distribution
   - TreasuryAdapter governance integration

### **Phase 2: Integration (Full Coordination Pipeline)**

- RequestHub → Claims bounty system
- DraftsManager → ValuableAction proposal workflow
- CommunityToken salary claims
- End-to-end testing

## 📋 **Detailed Implementation Plan**

### **TODO 1: Update ActionTypeRegistry → ValuableActionRegistry**

```solidity
// Current (ActionTypeRegistry.sol)
contract ActionTypeRegistry {
    mapping(uint256 => Types.ActionType) public typesById;
}

// Target (ValuableActionRegistry.sol)
contract ValuableActionRegistry {
    mapping(uint256 => Types.ValuableAction) public valuableActionsById;

    // Add governance approval flow
    // Add founder verification system
    // Add ROI-based economic parameters
}
```

### **TODO 2: Implement CommunityFactory**

```solidity
contract CommunityFactory {
    function createCommunity(
        CommunityParams params,
        address[] founders,
        ValuableAction[] initialActions
    ) external returns (uint256 communityId);

    // Deploy: ShiftGovernor, TimelockController, MembershipToken
    // Initialize: Founder verification, initial MembershipToken distribution
    // Bootstrap: Create initial ValuableActions for community setup
}
```

### **TODO 3: Fix MembershipToken Minting**

```solidity
// Remove deployer minting, add Claims integration
contract MembershipTokenERC20Votes {
    mapping(address => bool) public authorizedMinters; // Only Claims contract

    function mint(address to, uint256 amount) external onlyAuthorizedMinter {
        _mint(to, amount);
    }
}
```

### **TODO 4: Implement ROI-Based RevenueRouter**

```solidity
function calculateInvestorShare(address investor) external view returns (uint256) {
    InvestorRevenue memory inv = investorRevenue[investor];

    // Calculate current ROI percentage achieved
    uint256 currentROI = (inv.cumulativeRevenue * 10000) / inv.totalInvested;

    if (currentROI >= inv.targetROI) {
        return 0; // ROI target reached, no more revenue
    }

    // Linear decay: share decreases as ROI approaches target
    uint256 progress = (currentROI * 10000) / inv.targetROI;
    return inv.currentShare * (10000 - progress) / 10000;
}
```

### **TODO 5: Add CommunityToken Salary System**

```solidity
contract CommunityToken {
    struct SalaryClaim {
        uint256 period;
        uint256 totalSBTWeight;
        mapping(address => bool) claimed;
        mapping(address => uint256) amounts;
    }

    function claimSalary(uint256 period) external {
        // Verify SBT ownership and weight
        // Calculate proportional share
        // Distribute tokens
        // Mark as claimed
    }
}
```

## ⚙️ **Base Sepolia Deployment Configuration**

### **Environment Setup**

```bash
# .env
RPC_BASE_SEPOLIA="https://sepolia.base.org"
PRIVATE_KEY="0x..." # Deployer private key
ETHERSCAN_API_KEY="..." # For contract verification

# Base Sepolia Configuration
CHAIN_ID=84532
BLOCK_EXPLORER="https://sepolia.basescan.org"
```

### **Deployment Script Architecture**

```typescript
// scripts/hardhat/deploy.ts
async function deployMVP() {
  // 1. Deploy infrastructure (CommunityFactory)
  // 2. Deploy first community (Shift Core Community)
  // 3. Setup founder verification
  // 4. Create initial ValuableActions
  // 5. Verify contracts on BaseScan
  // 6. Output deployment addresses
}
```

### **Required Infrastructure**

- **USDC Contract**: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia)
- **Multicall3**: 0xcA11bde05977b3631167028862bE2a173976CA11 (Ethereum standard)
- **Create2Factory**: For deterministic addresses

## 🧪 **Testing Strategy**

### **Unit Tests (≥90% Coverage Target)**

```bash
forge test --match-contract "TestValuableActionRegistry|TestCommunityFactory|TestMembershipToken"
```

### **Integration Tests**

```solidity
describe("Full Governance Flow", () => {
    // Community creation → ValuableAction proposal → Claims → MembershipToken minting → Governance vote
});

describe("Revenue Distribution", () => {
    // Investment → Revenue generation → ROI-based distribution → Investor share decay
});
```

### **On-Chain Smoke Tests (Base Sepolia)**

```typescript
// After deployment, verify:
// 1. Community can be created
// 2. ValuableActions can be proposed
// 3. Claims can be submitted and verified
// 4. MembershipTokens mint correctly
// 5. Governance proposals can be created and executed
```

## 🚀 **Success Metrics**

### **Technical Readiness**

- [ ] All contracts compile successfully
- [ ] ≥86% test coverage (enforced by `scripts/check-coverage.sh`)
- [ ] Integration tests pass end-to-end workflows
- [ ] Base Sepolia deployment successful
- [ ] Contract verification on BaseScan complete

### **Functional Validation**

- [ ] Community can be created via CommunityFactory
- [ ] ValuableActions can be configured and activated
- [ ] Claims workflow: submit → verify → approve → mint SBT + MembershipToken
- [ ] Governance: proposals can be created, voted on, and executed
- [ ] Revenue distribution follows ROI-based decay formula

### **Business Readiness**

- [ ] System supports meta-governance use cases
- [ ] Documentation aligned with implementation
- [ ] Clear upgrade path for post-MVP features
- [ ] Performance suitable for community scale (100-1000 users)

---

**Next Steps**: Await confirmation to begin implementation of TODO items in priority order.
