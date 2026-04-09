# Data Model: Draft Action Composer Timelock Surface

## 1) TimelockAllowlistProfile
- Purpose: Canonical v1 authority dataset used by expert and guided mode gating.
- Proposed file: `apps/web/lib/actions/allowlists/base-sepolia-v1.json`
- Fields:
  - `profileId`: string (example: `base-sepolia-v1`)
  - `source`: object
    - `wiringFile`: string (`apps/web/lib/deploy/factory-step-executor.ts`)
    - `selectionRule`: string (`ADMIN_ROLE signatures handed to Timelock`)
    - `generatedAt`: ISO datetime
    - `generatorVersion`: string
  - `targets`: array of `AllowlistTarget`

## 2) AllowlistTarget
- Purpose: Target-level grouping for signatures.
- Fields:
  - `targetId`: enum
    - `valuableActionRegistry`
    - `verifierElection`
    - `verifierManager`
    - `verifierPowerToken`
    - `revenueRouter`
    - `treasuryAdapter`
    - `marketplace`
    - `paramController`
    - `cohortRegistry`
    - `investmentCohortManager`
    - `positionManager`
    - `credentialManager`
    - `communityRegistry`
  - `contractName`: string
  - `signatures`: string[] (exact canonical signatures, stable sorted)

## 3) ActionTargetAvailability
- Purpose: Runtime UX state for selectable/disabled target and reason.
- Fields:
  - `targetId`: ActionTargetId
  - `moduleAddress`: `0x...` | null
  - `allowlistedCount`: number
  - `enabled`: boolean
  - `disabledReason`: string | null
- Validation:
  - If module missing and target is module-scoped -> `enabled=false`, reason `Module not configured for this community`.
  - If no allowlisted signatures -> `enabled=false`, reason `No timelock-allowlisted functions available`.

## 4) GuidedTemplateDefinitionV1
- Purpose: SAFE template catalog driving deterministic guided actions.
- Proposed file: `apps/web/lib/actions/guided-templates.ts`
- Fields:
  - `templateId`: string
  - `label`: string
  - `description`: string
  - `targetId`: ActionTargetId
  - `signature`: exact signature string
  - `inputSchema`: array of typed fields
  - `validation`: bounds/rules
  - `encode`: deterministic encoder metadata (no dynamic function discovery)
  - `effectCopy`: concise user-visible impact copy
  - `disabledReason(context)`: resolver for missing module / not allowlisted

## 5) PreparedAction
- Purpose: Queue item rendered and submitted to `DraftsManager`.
- Existing shape retained:
  - `target`: address
  - `value`: bigint
  - `calldata`: bytes
  - `targetLabel`: string
  - `functionName`: string (or signature label)
  - `argsPreview`: string[]

## 6) ActionBundle
- Purpose: Draft payload compatible with existing on-chain flow.
- Fields:
  - `targets[]`: address[]
  - `values[]`: uint256[]
  - `calldatas[]`: bytes[]
  - `actionsHash`: bytes32
- Deterministic rule:
  - `actionsHash = keccak256(encodePacked(address[] targets, uint256[] values, bytes[] calldatas))`
  - Queue order is authoritative.

## 7) GeneratorReport
- Purpose: CI/PR visibility for allowlist generation.
- Proposed output: `apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json`
- Fields:
  - `targetCount`
  - `signatureCount`
  - `ignoredNonAdminAssignments`
  - `abiValidationFailures` (must be empty on success)
