# Base Mainnet Deployment Checklist

## ✅ Pre-Deployment Verification

### **1. Environment Setup**
- [ ] `.env` file configured with production values
- [ ] `PRIVATE_KEY` set to deployer wallet (with sufficient ETH)
- [ ] `RPC_BASE` set to Base mainnet RPC (optional, defaults to https://mainnet.base.org)

### **2. Wallet Funding**
- [ ] Deployer wallet has **≥0.2 ETH** on Base mainnet for gas
  - Base Sepolia cost: ~0.15 ETH (testnet)
  - Base mainnet expected: ~0.1-0.15 ETH (much cheaper gas)
- [ ] Founder address confirmed (defaults to deployer)

### **3. Configuration Review**

Current settings (in `scripts/deploy-complete.ts`):
```
Community Name: "Shift DeSoc Community"
Voting Delay: 7200 seconds (2 hours)
Voting Period: 86400 seconds (1 day)
Execution Delay: 21600 seconds (6 hours)
Revenue Split: 60/30/10 (workers/treasury/investors)
USDC Address: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 ✅
```

**To customize**, edit environment variables or modify `NETWORK_CONFIGS.base` in deploy script.

### **4. Gas Settings** ✅ OPTIMIZED FOR BASE MAINNET
- Base mainnet: 0.05 gwei max, 0.01 gwei priority (auto-configured)
- Base Sepolia: 2 gwei max, 1 gwei priority (auto-configured)

### **5. Network Configuration** ✅ READY
- Chain ID: 8453 (Base mainnet)
- RPC: https://mainnet.base.org
- Block Explorer: https://basescan.org

## 🚀 Deployment Process

### **Step 1: Final Verification**
```bash
# Verify deployer balance
pnpm check:balance --network base

# Verify hardhat configuration
cat hardhat.config.ts | grep -A 5 "base:"
```

### **Step 2: Deploy to Base Mainnet**
```bash
pnpm deploy:base
```

This will:
1. Deploy all 22 contracts (~5-10 minutes)
2. Configure system integration
3. Bootstrap initial community (Community ID 1)
4. Mint 10,000 governance tokens to founder
5. **Save addresses to `deployments/base.json`** ✅
6. **Save addresses to `deployments/latest.json`** ✅

### **Step 3: Verify Deployment**
```bash
# Verify all addresses were saved correctly
pnpm verify:addresses

# Check deployment file
cat deployments/base.json

# Verify contracts on BaseScan
# (script will output block explorer URLs)
```

### **Step 4: Post-Deployment Setup**
```bash
# Initialize VPT community (required before minting VPT tokens)
# This needs to be done via a governance proposal or direct timelock call

# Check system status
pnpm manage --network base status

# Verify community registration
pnpm manage --network base community info 1
```

## 📊 Expected Costs

| Item | Base Sepolia | Base Mainnet (Est.) |
|------|--------------|---------------------|
| Gas Price | 2 gwei | 0.05 gwei |
| Total Gas Used | ~75M gas | ~75M gas |
| **Total Cost** | ~0.15 ETH (~$400) | ~0.004 ETH (~$10) |

**Base mainnet is ~40x cheaper than Base Sepolia!** 🎉

## ⚠️ Important Notes

### **Production Considerations**

1. **Founder Address**: The deployer becomes the initial founder with 10,000 governance tokens
   - To use a different founder, set `FOUNDER_ADDRESS` in `.env`

2. **VPT Token Initialization**: 
   - VPT tokens require timelock role to mint
   - Must initialize community in VPT contract first: `verifierPowerToken.initializeCommunity(1, "ipfs://...")`
   - This should be done via governance proposal after deployment

3. **Timelock Security**:
   - Deployer renounces timelock admin role after deployment
   - Only governance can execute timelock actions
   - 6-hour execution delay for all governance decisions

4. **Contract Verification**:
   - Contracts are not auto-verified on BaseScan
   - Use `pnpm verify` after deployment (script TBD)

5. **Backup Deployment Addresses**:
   - `deployments/base.json` is auto-generated ✅
   - Also saved to `deployments/latest.json` ✅
   - **Commit to git immediately after deployment!**

## 🔍 Post-Deployment Verification Checklist

- [ ] All 22 contracts deployed successfully
- [ ] `deployments/base.json` created with all addresses
- [ ] Deployer renounced timelock admin role
- [ ] Governor has PROPOSER_ROLE and EXECUTOR_ROLE
- [ ] Claims contract has MINTER_ROLE for MembershipToken
- [ ] Founder received 10,000 governance tokens
- [ ] Founder delegated voting power to self
- [ ] Community ID 1 registered in CommunityRegistry
- [ ] All module addresses configured in CommunityRegistry
- [ ] VPT parameters configured (panel size, min approvals, etc.)
- [ ] Revenue policy configured (60/30/10 split)
- [ ] Commerce modules integrated (Marketplace, Disputes, etc.)
- [ ] Contract addresses committed to git

## 🚨 Emergency Contacts & Recovery

### **If Deployment Fails Mid-Way:**

The deployment is **atomic per section** - if it fails, you'll see which step failed:
- Core Infrastructure (2 contracts)
- Governance System (4 contracts)
- VPT System (3 contracts)
- Work Verification (3 contracts)
- Economic Layer (4 contracts)
- Community Modules (6 contracts)
- Configuration (role grants, parameters)
- Bootstrap (community registration, token minting)

**Recovery options:**
1. Fix the issue (gas, network, etc.) and re-run `pnpm deploy:base`
2. Use `pnpm setup:fix-issues --network base` for surgical fixes
3. Contact development team for manual recovery

### **Network Issues:**
- Base RPC issues: Switch to backup RPC in `.env`
- Gas price spikes: Script will auto-retry with higher gas
- Nonce conflicts: 2-second delays prevent this automatically

## 📞 Support

- **Deployment Issues**: Check `deployments/base.json` for partial deployment
- **Gas Issues**: Base mainnet is very cheap (~$10 total), but ensure ≥0.2 ETH for safety
- **Contract Verification**: Will need to verify manually on BaseScan after deployment

---

**Ready to deploy?** Run: `pnpm deploy:base`
