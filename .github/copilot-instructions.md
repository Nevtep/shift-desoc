# Shift Governance Platform - AI Coding Instructions

## Project Architecture

Shift is an on-chain governance platform with multi-choice voting built on a **dual-toolchain** Solidity setup (Hardhat + Foundry) and Next.js frontend. The core workflow: `requests → drafts → proposals (multi-choice voting) → timelock execution`.

### Key Components

- **Core Governance**: `ShiftGovernor` extends OpenZeppelin Governor with multi-choice voting via `CountingMultiChoice` 
- **Workflow Modules**: `DraftsManager` (proposal creation), `Claims` (work verification), `RequestHub` (task requests)
- **Token Economy**: `WorkerSBT` (soulbound tokens), `CommunityToken` (1:1 USDC backing), `MembershipTokenERC20Votes` (governance)
- **Infrastructure**: `VerifierPool` (juror selection), `ActionTypeRegistry`, `Marketplace`, `HousingManager`

## Development Workflow

### Smart Contracts
- **Dual toolchain**: Use Foundry for testing (`forge test -vvv`), Hardhat for deployment
- **Coverage requirement**: ≥96% via `pnpm cov:gate` (enforced in CI)
- **Contract structure**: `contracts/{core,modules,tokens,libs}` with shared `../../contracts` source
- **Compilation**: `pnpm build` compiles both Hardhat and Foundry

### Key Commands
```bash
pnpm hh:compile && pnpm forge:test    # Full contract build/test
pnpm cov:gate                         # Coverage gate (≥96% required)
pnpm -C packages/hardhat hardhat run scripts/deploy.ts --network base_sepolia
```

### Testing Patterns
- **Unit tests**: Foundry in `packages/foundry/test/` 
- **Integration**: Use `MultiChoiceTest` pattern with `setUp()` and weight arrays
- **Coverage**: Must hit ≥96% total via `scripts/check-coverage.sh`

## Solidity Conventions

### Multi-Choice Voting Pattern
```solidity
// Enable multi-choice on ShiftGovernor
pid = governor.proposeMultiChoice(targets, values, calldatas, description, numOptions);

// Vote with weight distribution (must sum ≤ 1e18)
uint256[] memory weights = [6e17, 3e17, 1e17]; // 60%, 30%, 10%
countingMulti.castVoteMulti(proposalId, voter, totalWeight, weights, reason);
```

### Action Type System
Use `Types.ActionType` struct for configurable verification:
- `jurorsMin/panelSize` (M-of-N verification)  
- `weight` (WorkerPoints reward)
- `verifyWindow/cooldown` (timing constraints)
- `evidenceSpecCID` (IPFS evidence requirements)

### Error Handling
Import from `contracts/libs/Errors.sol` and use custom errors, not strings.

## Frontend Architecture

### Marketing Site (Next.js 14)
- **Location**: `apps/marketing/` with App Router + Storybook
- **Component library**: `src/components/` with `.stories.tsx` files
- **Design system**: Import from Figma via MCP servers (`mcp_figma_get_design_context`)
- **Pages**: Home, Acciones Valorables, Proyectos, Token Comunitario, Marketplace, Co-housing, Roadmap, FAQ
- **Development**: `pnpm -C apps/marketing storybook` for component development

### Mobile dApp (Expo + React Native)
- **Architecture**: Mobile-first with RN Web for cross-platform
- **File naming**: `*.component.tsx` (visual), `*.container.tsx` (business logic), `*.datasource.tsx` (data layer)
- **Styling**: Tailwind NativeWind or consistent utility styles
- **Key screens**: Home feed, Request Detail, Draft Builder, Voting (multi-choice), Claims, Projects, Marketplace, Housing, Profile, Treasury
- **Data layer**: ethers + Wagmi/WalletConnect on Base network, IPFS uploads, optimistic UI

### Figma Integration
- **Design import**: Use `mcp_figma_get_design_context` tool for component generation
- **Design tokens**: Extract variables with `mcp_figma_get_variable_defs`
- **Workflow**: Figma → MCP extraction → Storybook components → implementation

## Integration Points

### Governor Extensions
`ShiftGovernor` integrates multi-choice via:
1. `proposeMultiChoice()` - creates proposal with option count
2. `CountingMultiChoice.enableMulti()` - activates multi-choice counting
3. Vote weights must sum ≤ 1e18 (enforced in `CountingMultiChoice`)

### Module Communication
- `DraftsManager` → `IGovernorLike` (proposal escalation)
- `Claims` → `VerifierPool` (juror selection, bonds)
- `WorkerSBT` ← `Claims` (mint on approval)
- All modules configurable via `ParamController`

### Deployment Flow
1. Deploy token contracts (`MembershipTokenERC20Votes`, `CommunityToken`)
2. Deploy `TimelockController` 
3. Deploy `ShiftGovernor` with token/timelock addresses
4. Deploy and wire `CountingMultiChoice` via `setCountingMulti()`
5. Deploy module contracts with governor/registry addresses

## Critical Constraints

- **Solidity**: ^0.8.24, OpenZeppelin 5.x, CEI pattern, reentrancy guards
- **Gas optimization**: 200 optimizer runs, avoid loops in view functions
- **Testing**: All state transitions must be tested, especially multi-choice edge cases
- **Documentation**: NatSpec required for all public functions
- **Base Sepolia**: Target deployment network with verification enabled

Use `pnpm fmt` before commits. The codebase expects immediate productivity on governance mechanics, token economics, and verification workflows.