#!/bin/bash

echo "🔑 Generating 5 Test Wallets for E2E Testing"
echo "============================================"

cd "$(dirname "$0")/../packages/foundry"

echo "Generating wallets..."
echo ""

for i in {1..5}; do
    echo "👤 User$i:"
    wallet_output=$(cast wallet new)
    address=$(echo "$wallet_output" | grep "Address:" | awk '{print $2}')
    private_key=$(echo "$wallet_output" | grep "Private key:" | awk '{print $3}')
    
    echo "Address: $address"
    echo "Private Key: $private_key"
    echo "USER${i}_ADDRESS=$address"
    echo "USER${i}_PRIVATE_KEY=$private_key"
    echo ""
done

echo "📝 Copy the USER*_ADDRESS and USER*_PRIVATE_KEY lines above to your .env file"
echo ""
echo "💰 Don't forget to fund each address with Sepolia ETH:"
echo "   - Visit: https://sepoliafaucet.com/"
echo "   - Or: https://sepolia-faucet.pk910.de/"
echo "   - Send ~0.1 ETH to each address for gas fees"