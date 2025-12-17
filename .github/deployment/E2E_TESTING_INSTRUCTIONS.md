# 🚀 INSTRUCCIONES FINALES PARA E2E TESTING EN SEPOLIA

## Problema Actual

- Foundry: Problemas con .env y Unicode characters
- Hardhat: Conflictos de rutas y typechain

## Solución: Testing Manual Directo

### Paso 1: Fondear Wallets 💰

Fondea estas direcciones con **0.1 ETH cada una** en Sepolia:

```
USER1: 0x61A31c7ff36bed6d97CA5A4dDc4153db87e63397
USER2: 0x741Ff780D7a6aad57c0d2012FDAf3dE533E761A6
USER3: 0x6dC538F47af2fa737812A847001161b7C089e889
USER4: 0x6b01E73447918A0964D2Bb50e9802970eCB4b2ef
USER5: 0xB2e409CfBAFC05db3c46313BB18FA1897375DB7d
```

**Faucets Sepolia:**

- https://sepoliafaucet.com/
- https://sepolia-faucet.pk910.de/
- https://www.alchemy.com/faucets/ethereum-sepolia

### Paso 2: Deploy con Cast (Foundry CLI) 🔧

Una vez fondeadas las wallets, usar cast directamente:

```bash
cd /Users/core/Code/shift

# Deploy cada contrato manualmente
PRIVATE_KEY="193d28809b11c9c8ba7b12d638c71d5dae49b6ed3f6f5f9550a91d6a4286803a"
RPC="https://ethereum-sepolia-rpc.publicnode.com"

# 1. Deploy MembershipToken
TOKEN=$(cast create contracts/tokens/MembershipTokenERC20Votes.sol:MembershipTokenERC20Votes \
  --constructor-args "Shift Membership" "sMEM" \
  --private-key $PRIVATE_KEY --rpc-url $RPC)

# 2. Deploy Timelock
TIMELOCK=$(cast create @openzeppelin/contracts/governance/TimelockController.sol:TimelockController \
  --constructor-args 3600 "[]" "[]" "0x0000000000000000000000000000000000000000" \
  --private-key $PRIVATE_KEY --rpc-url $RPC)

# 3. Deploy Governor
GOVERNOR=$(cast create contracts/core/ShiftGovernor.sol:ShiftGovernor \
  --constructor-args $TOKEN $TIMELOCK \
  --private-key $PRIVATE_KEY --rpc-url $RPC)

# 4. Deploy CommunityRegistry
REGISTRY=$(cast create contracts/modules/CommunityRegistry.sol:CommunityRegistry \
  --constructor-args "0x193d28809b11c9c8ba7b12d638c71d5dae49b6ed3f" \
  --private-key $PRIVATE_KEY --rpc-url $RPC)

# Y así sucesivamente...
```

### Paso 3: Testear Interacciones Manualmente 🎭

```bash
# Transfer tokens a users
cast send $TOKEN "transfer(address,uint256)" $USER1_ADDRESS 1000000000000000000000 \
  --private-key $PRIVATE_KEY --rpc-url $RPC

# Delegate voting power
cast send $TOKEN "delegate(address)" $USER1_ADDRESS \
  --private-key $USER1_PRIVATE_KEY --rpc-url $RPC

# Create community
cast send $REGISTRY "registerCommunity(string,string,string,uint256)" \
  "Test Community" "E2E Testing" "ipfs://test" 0 \
  --private-key $PRIVATE_KEY --rpc-url $RPC

# Y continuar con el flujo completo...
```

### Paso 4: Alternativa - Usar Remix IDE 🌐

**Opción más fácil:**

1. **Ve a https://remix.ethereum.org**
2. **Copia los contratos a Remix**
3. **Compila en Remix (sin problemas de rutas)**
4. **Deploy directo a Sepolia desde Remix**
5. **Usar Metamask con las wallets generadas**
6. **Testear E2E interactivamente**

## Conclusión: Herramientas vs Objetivos

- **Para DESARROLLO**: Foundry es excelente
- **Para E2E TESTING**: Remix + Metamask es más confiable
- **Para PRODUCCIÓN**: Hardhat con configuración adecuada

### Próximo Paso Recomendado:

1. **Fondear las 5 wallets** ← ESTO PRIMERO
2. **Usar Remix para deploy y testing**
3. **Una vez funcionando, automatizar con scripts**

¿Quieres que procedamos con el fondeo de wallets y luego Remix?
