# Data Model: Wizard Permission Parity

## Entity: PermissionMatrixEntry
- Description: One selector-role mapping row derived from wizard selectorRoleAssignments.
- Fields:
  - contractName: string (non-empty)
  - targetKey: string (canonical composer target id)
  - targetVariable: string (source variable symbol in wiring)
  - signature: string (exact Solidity signature)
  - selector: string (0x + 8 hex chars)
  - roleName: string (ADMIN_ROLE or named role constant)
  - roleValue: string (resolved numeric/identifier value)
  - sourceFile: string
  - sourceLine: number (>= 1)
- Validation:
  - signature must be unique per targetKey + roleName combination
  - selector must equal keccak(signature)[0:4]
  - roleName ADMIN_ROLE rows are candidates for timelock surface
- State transitions:
  - extracted -> abi_verified -> surface_classified

## Entity: HandoffEvidence
- Description: Evidence that ADMIN_ROLE is owned by timelock post-handoff and revoked from bootstrap/deployer.
- Fields:
  - accessManager: address
  - adminRoleValue: string
  - timelock: address
  - handoffFrom: address
  - bootstrapCoordinator: address | null
  - timelockHasAdminBefore: boolean
  - timelockHasAdminAfter: boolean
  - handoffFromHasAdminAfter: boolean
  - bootstrapHasAdminAfter: boolean | null
  - evidenceMode: enum(static, runtime, static_plus_runtime)
- Validation:
  - timelockHasAdminAfter must be true
  - handoffFromHasAdminAfter must be false

## Entity: AbiValidationResult
- Description: Result of matching matrix signatures against ABI fragments.
- Fields:
  - contractName: string
  - targetKey: string
  - signature: string
  - selector: string
  - matched: boolean
  - mismatchReason: enum(signature_not_found, selector_mismatch, artifact_missing)
- Validation:
  - matched true requires exact signature presence and selector equality

## Entity: TimelockSurfaceContract
- Description: Grouped timelock-executable signatures for a target.
- Fields:
  - contractName: string
  - targetKey: string
  - signatures: string[] (sorted asc, unique)
  - selectors: string[] (sorted asc, unique)
- Validation:
  - signatures length > 0
  - signatures/selectors 1:1 mapping
  - every row source roleName is ADMIN_ROLE and handoff evidence passes

## Entity: AllowlistProfile
- Description: Canonical expert-mode function allowlist consumed by web composer.
- Fields:
  - profileId: string
  - source:
    - wiringFile: string
    - selectionRule: string
    - generatedAt: string (stable)
    - generatorVersion: string
  - targets: AllowlistTargetEntry[]
- Validation:
  - targets sorted by targetId
  - signatures sorted and unique
  - every signature appears in timelock surface

## Entity: ExpertTargetAvailability
- Description: Runtime availability state for each target in expert mode.
- Fields:
  - targetId: string
  - moduleAddress: address | null
  - allowlistedCount: number
  - enabled: boolean
  - disabledReason: enum(module_missing, no_allowlisted_timelock_functions) | null
- Validation:
  - enabled iff moduleAddress != null and allowlistedCount > 0

## Entity: CrucialFlowTemplate
- Description: Guided template item representing crucial governance flow.
- Fields:
  - layer: enum(coordination, governance, verification, economy, commerce_housing)
  - flowId: string
  - targetKey: string
  - signature: string
  - safetyConstraints: object
  - effectCopy: string
  - enabled: boolean
  - disabledReason: string | null
- Validation:
  - enabled only if signature is allowlisted for targetKey
  - disabledReason required if enabled is false

## Entity: GapReportItem
- Description: Crucial flow not currently timelock-executable.
- Fields:
  - layer: string
  - flowId: string
  - targetKey: string
  - signature: string
  - reason: string
  - requiredSelectorRoleAssignment:
    - targetVariable: string
    - role: string
    - signature: string
- Validation:
  - reason must indicate non-allowlisted or non-admin mapping cause
