# Data Model - Canonicalize Engagements Surface

## Entity: EngagementsSurface
- Purpose: Canonical user-facing and integration-facing work-verification surface.
- Fields:
  - canonicalName: string (`Engagements`)
  - deprecatedNames: string[] (`Claims` for work verification only)
  - routeBase: string (`/engagements`)
  - compatibilityRoutes: string[] (`/claims`, `/claims/[claimId]` during transition)
  - contractKey: string (`engagements`)
  - abiFile: string (`apps/web/abis/Engagements.json`)

## Entity: EconomicClaimSurface
- Purpose: Economic payout/claiming semantics that must remain distinct.
- Fields:
  - semanticDomain: string (`economic`)
  - allowedTerminology: string[] (`claim`, `claims`, `payout`)
  - disallowedCanonicalization: boolean (true for engagement renaming pass)

## Entity: TerminologyMappingRule
- Purpose: Deterministic mapping for in-scope renames.
- Fields:
  - sourceTerm: string
  - targetTerm: string
  - scope: enum (`ui_label`, `route`, `component_name`, `query_name`, `contract_config_key`, `docs_status`)
  - exclusions: string[] (economic claiming contexts)

## Entity: CompatibilityWindow
- Purpose: Temporary backward-compatibility handling for route/exports.
- Fields:
  - legacyPath: string
  - canonicalPath: string
  - strategy: enum (`redirect`, `re-export`, `alias`) 
  - sunsetCondition: string (remove when all internal links/tests migrated)

## State Transitions
1. Deprecated
- Conditions: UI/integration uses work-verification `Claims` naming.

2. Dual-Supported (temporary)
- Conditions: Canonical `Engagements` surface exists and legacy aliases/redirects still active.

3. Canonical
- Conditions: Active internal references/tests/docs use `Engagements` for work verification; legacy aliases removed or explicitly deprecated.

## Validation Rules
- Rule 1: Work verification references MUST resolve to Engagements domain.
- Rule 2: Economic claim contexts MUST NOT be renamed to Engagements.
- Rule 3: Manager contract config for work verification MUST resolve `addresses.engagements` from deployments JSON.
- Rule 4: ABI source for work verification in Manager MUST be `Engagements.json`.
- Rule 5: Status artifacts must remain synchronized per constitution.
