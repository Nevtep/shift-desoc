# Shift DeSoc Cohort Management System

This comprehensive guide covers the investment cohort management system implemented in Shift DeSoc, including deployment, configuration, and operation of the cohort-based economic system.

## 📋 Table of Contents

1. [Environment Setup](#environment-setup)
2. [System Deployment](#system-deployment)
3. [Cohort Management](#cohort-management)
4. [Revenue Distribution](#revenue-distribution)
5. [Monitoring and Analytics](#monitoring-and-analytics)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)

## ⚙️ Environment Setup

### 1. Environment Variables Preparation

```bash
# Copy the example configuration file
cp .env.example .env

# Edit with your specific values
nano .env
```

### Critical Variables for Cohorts

```bash
# Deployment network
NETWORK=base_sepolia

# Deployer private key (ensure it has ETH)
PRIVATE_KEY=0x...

# Contract addresses (filled after deployment)
COHORT_REGISTRY_ADDRESS=0x...
REVENUE_ROUTER_ADDRESS=0x...
PARAM_CONTROLLER_ADDRESS=0x...
COMMUNITY_TOKEN_ADDRESS=0x...

# USDC configuration
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

### 2. Dependencies Installation

```bash
# Install all dependencies
pnpm install

# Compile contracts
pnpm build

# Run tests
pnpm test
```

## 🚀 System Deployment

### Complete Deployment on Base Sepolia

```bash
# Complete system deployment including cohorts
pnpm deploy:base-sepolia
```

The deployment script:

- ✅ Deploys all core contracts
- ✅ Configures CohortRegistry with initial parameters
- ✅ Integrates RevenueRouter with waterfall distribution
- ✅ Verifies all contracts on BaseScan
- ✅ Saves addresses to `.env`

### Deployment Verification

```bash
# Verify system status
pnpm validate-deployment --network base_sepolia

# Run E2E tests
pnpm test:e2e --network base_sepolia

# Analyze gas costs
pnpm gas-costs --network base_sepolia
```

## 🏦 Cohort Management

### Basic Commands

```bash
# View complete help
pnpm manage:cohorts help

# List active cohorts
pnpm manage:cohorts list 1

# View detailed cohort information
pnpm manage:cohorts info 1
```

### Create New Cohort

```bash
# Create cohort with custom parameters
pnpm manage:cohorts create [communityId] [targetROI%] [weight] [maxInvestors] [minInvest] [maxRaise] [termsURI]

# Example: Conservative cohort
pnpm manage:cohorts create 1 115 1500 30 2500 150000 ipfs://QmConservativeTerms

# Example: Growth cohort
pnpm manage:cohorts create 1 130 3000 15 15000 500000 ipfs://QmGrowthTerms
```

### Cohort Parameters

- **communityId**: Community ID (typically 1)
- **targetROI%**: Target ROI (115 = 115%, 130 = 130%)
- **weight**: Priority weight in distribution (1000-5000)
- **maxInvestors**: Maximum number of investors
- **minInvest**: Minimum investment in USDC
- **maxRaise**: Maximum total raise
- **termsURI**: IPFS reference to investment terms

### Add Investors

```bash
# Add specific investor
pnpm manage:cohorts add-investor <cohortId> <investorAddress> <amount>

# Example
pnpm manage:cohorts add-investor 1 0x742d35Cc6631C0532925a3b8D2270E49B3a7DC13 25000
```

## 💰 Revenue Distribution

### Simulate Distribution

```bash
# Simulate distribution of $10,000
pnpm manage:cohorts simulate 1 10000

# Example output:
# 💰 Distribution Breakdown:
#    Workers: $4,000.00 USDC (40%)
#    Treasury: $2,500.00 USDC (25%)
#    Investors: $3,500.00 USDC (35%)
#
# 📊 Cohort Distribution:
#    Cohort 1: $2,100.00 (Weight: 3000)
#    Cohort 2: $1,400.00 (Weight: 2000)
```

### Execute Real Distribution

```bash
# Distribute real revenue
pnpm manage:cohorts distribute 1 10000

# ⚠️  WARNING: This operation transfers real tokens
```

### Waterfall Distribution Model

1. **Workers Min (40%)**: Fixed amount for workers
2. **Treasury Base (25%)**: Community operational reserves
3. **Investor Pool (35%)**: Distributed by cohort weights
4. **Spillover**: Excess goes to treasury if cohorts completed

## 📊 Monitoring and Analytics

### Detailed Cohort Information

```bash
pnpm manage:cohorts info 1
```

**Example output:**

```
📊 Cohort 1 Information
📋 Basic Information:
   Community ID: 1
   Target ROI: 120%
   Priority Weight: 2500
   Max Investors: 25
   Current Investors: 12

💰 Financial Status:
   Total Invested: $180,000.00 USDC
   Total Returned: $95,000.00 USDC
   Target Total: $216,000.00 USDC
   Current ROI: 52%
   Progress: 43%

⚖️  Distribution:
   Current Weight: 2500
   Active: ✅
   Completed: ❌
```

### List All Cohorts

```bash
pnpm manage:cohorts list 1
```

## 📋 Common Use Cases

### 1. Initial Community Setup

```bash
# Step 1: Deploy complete system
pnpm deploy:base-sepolia

# Step 2: Create first conservative cohort
pnpm manage:cohorts create 1 115 2000 30 5000 200000 ipfs://QmConservativeTerms

# Step 3: Add founding investors
pnpm manage:cohorts add-investor 1 0xFounder1... 50000
pnpm manage:cohorts add-investor 1 0xFounder2... 35000
```

### 2. Monthly Revenue Management

```bash
# Step 1: Simulate monthly revenue distribution
pnpm manage:cohorts simulate 1 25000

# Step 2: Review cohorts before distribution
pnpm manage:cohorts list 1

# Step 3: Execute real distribution
pnpm manage:cohorts distribute 1 25000

# Step 4: Verify new cohort states
pnpm manage:cohorts info 1
pnpm manage:cohorts info 2
```

### 3. Diversified Cohort Creation

```bash
# Conservative cohort (low ROI, high capacity)
pnpm manage:cohorts create 1 112 1500 50 2000 300000

# Balanced cohort (medium ROI, medium capacity)
pnpm manage:cohorts create 1 125 2500 25 10000 400000

# Growth cohort (high ROI, low capacity)
pnpm manage:cohorts create 1 140 4000 10 25000 500000
```

## 🔧 Troubleshooting

### Common Errors

#### "Insufficient balance for gas"

```bash
# Check deployer balance
pnpm check:balance --network base_sepolia

# Get ETH from Base Sepolia faucet
# https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
```

#### "CohortRegistry not deployed"

```bash
# Verify complete deployment
pnpm validate-deployment --network base_sepolia

# Re-deploy if necessary
pnpm deploy:base-sepolia
```

#### "Investor already in cohort"

```bash
# Check cohort state first
pnpm manage:cohorts info <cohortId>

# Investors can only be in one cohort per community
```

### Security Validations

```bash
# Verify contract permissions
pnpm check:permissions --network base_sepolia

# Analyze governance state
pnpm check:governance --network base_sepolia

# Verify claims and rewards status
pnpm check:claims --network base_sepolia
pnpm check:rewards --network base_sepolia
```

### Logs and Debugging

```bash
# Enable detailed logging
export DEBUG=true

# Run commands with verbose output
pnpm manage:cohorts create 1 120 2000 25 5000 250000 --verbose

# Review transactions on BaseScan
# https://sepolia.basescan.org/address/<CONTRACT_ADDRESS>
```

## 🎯 Recommended Configurations

### For New Communities (First 6 months)

```bash
# Launch cohort - conservative to attract initial investors
pnpm manage:cohorts create 1 115 3000 20 10000 300000 ipfs://QmLaunchTerms
```

### For Established Communities (6+ months)

```bash
# Diversified portfolio of 3 cohorts
pnpm manage:cohorts create 1 112 1800 40 5000 400000    # Conservative
pnpm manage:cohorts create 1 125 2500 25 15000 600000   # Balanced
pnpm manage:cohorts create 1 140 3500 15 30000 800000   # Growth
```

### For Mature Communities (2+ years)

```bash
# Specialized cohorts by project type
pnpm manage:cohorts create 1 118 2200 30 8000 500000    # Infrastructure
pnpm manage:cohorts create 1 135 3200 20 20000 700000   # Products
pnpm manage:cohorts create 1 150 4500 10 50000 1000000  # Research
```

## 📞 Support

For technical support:

1. Review documentation in `/docs/EN/`
2. Run `pnpm validate-deployment`
3. Check logs on BaseScan
4. Consult with the development team

---

This cohort system allows communities to manage investments transparently, with guaranteed ROI and automatic distribution based on the community's actual performance. 🚀
