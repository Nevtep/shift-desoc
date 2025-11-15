# Multi-Wallet Setup for E2E Testing

## Quick Wallet Generation

You can generate test wallets using cast:

```bash
# Generate 5 test wallets
cd /Users/core/Code/shift/packages/foundry

echo "Generating test wallets..."
echo "User1 - Community Creator:"
cast wallet new
echo ""

echo "User2 - Draft Creator:"
cast wallet new
echo ""

echo "User3 - Voter:"
cast wallet new
echo ""

echo "User4 - Voter:"
cast wallet new
echo ""

echo "User5 - Voter:"
cast wallet new
echo ""
```

## Update .env file

After generating wallets, update `/packages/foundry/.env` with the addresses and private keys:

```
USER1_ADDRESS=0x...
USER1_PRIVATE_KEY=0x...

USER2_ADDRESS=0x...
USER2_PRIVATE_KEY=0x...

# ... etc for users 3,4,5
```

## Fund Wallets with Sepolia ETH

You need to fund each wallet with Sepolia ETH for gas fees:

1. **Get Sepolia ETH from Faucets:**
   - https://sepoliafaucet.com/
   - https://sepolia-faucet.pk910.de/
   - https://www.alchemy.com/faucets/ethereum-sepolia

2. **Send ~0.1 ETH to each wallet address**

3. **Verify balances:**
```bash
cast balance USER1_ADDRESS --rpc-url $SEPOLIA_RPC_URL
cast balance USER2_ADDRESS --rpc-url $SEPOLIA_RPC_URL
# ... etc
```

## Contract Addresses

After deployment, you'll need to update the contract addresses in `.env`:

```bash
# Run deployment
forge script script/DeployMVP.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $PRIVATE_KEY --broadcast

# Copy the outputted addresses to .env file
TOKEN=0x...
GOVERNOR=0x...
# ... etc
```

## E2E Test Execution

Once everything is set up:

```bash
# Run the complete E2E governance scenario
forge script script/E2EGovernanceTest.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

This will execute the full governance workflow:
1. User1 creates community & request
2. User2 creates draft with ActionType proposal  
3. Users 3,4,5 add comments/reviews
4. Draft escalates to governance proposal
5. Users vote (3 for, 1 against, 1 abstain)
6. Proposal executes and ActionType is created

## Important Notes

- **Gas Costs**: Each transaction costs gas, budget ~0.01-0.05 ETH per wallet
- **Token Distribution**: The deployer gets initial tokens and must transfer to test users
- **Voting Power**: Users must delegate to themselves after receiving tokens
- **Timelock Delays**: Proposals have execution delays (1 hour in test setup)