# Action Composer Internal Contracts (v1)

This file defines implementation-facing interface contracts between allowlist data, guided templates, target resolution, and composer UI behavior.

## 1) Allowlist Data Contract

Proposed runtime source:
- `apps/web/lib/actions/allowlists/base-sepolia-v1.json`

```json
{
  "profileId": "base-sepolia-v1",
  "source": {
    "wiringFile": "apps/web/lib/deploy/factory-step-executor.ts",
    "selectionRule": "ADMIN_ROLE signatures handed to Timelock",
    "generatedAt": "2026-04-08T00:00:00.000Z",
    "generatorVersion": "1"
  },
  "targets": [
    {
      "targetId": "valuableActionRegistry",
      "contractName": "ValuableActionRegistry",
      "signatures": ["setValuableActionSBT(address)"]
    }
  ]
}
```

Behavioral contract:
- Exact signatures only.
- Stable lexicographic ordering for targets and signatures.
- Single profile for v1.

## 2) Target Resolution Contract

Resolver module (proposed):
- `apps/web/lib/actions/target-resolution.ts`

Type contract:
```ts
export type ActionTargetId =
  | "valuableActionRegistry"
  | "verifierElection"
  | "verifierManager"
  | "verifierPowerToken"
  | "revenueRouter"
  | "treasuryAdapter"
  | "marketplace"
  | "paramController"
  | "cohortRegistry"
  | "investmentCohortManager"
  | "positionManager"
  | "credentialManager"
  | "communityRegistry";

export type TargetAvailability = {
  targetId: ActionTargetId;
  label: string;
  moduleAddress: `0x${string}` | null;
  enabled: boolean;
  disabledReason: string | null;
};
```

Behavioral contract:
- Targets always visible in expert mode.
- Missing module or zero allowlisted signatures -> disabled target with explicit reason.

## 3) Expert Function Selection Contract

Resolver module (proposed):
- `apps/web/lib/actions/expert-functions.ts`

Type contract:
```ts
export type AllowlistedFunction = {
  signature: string;
  abiFragment: AbiFunction;
};

export function getAllowlistedFunctionsForTarget(
  targetId: ActionTargetId,
  abi: Abi,
  allowlistedSignatures: string[]
): AllowlistedFunction[];
```

Behavioral contract:
- No heuristic mutable-function scanning.
- Signature+inputs must match ABI fragment exactly.
- Overloads represented as distinct entries when they exist in ABI.
- Tuple/array raw param support reuses existing expert encoder path.

## 4) Guided Template Contract

Catalog module (proposed):
- `apps/web/lib/actions/guided-templates.ts`

Type contract:
```ts
export type GuidedTemplate = {
  templateId: string;
  targetId: ActionTargetId;
  signature: string;
  label: string;
  description: string;
  effectCopy: string;
  validate(input: unknown): { ok: boolean; message?: string };
  encode(input: unknown, context: { communityId: bigint }): Hex;
  disabledReason(context: {
    moduleAddress: `0x${string}` | null;
    isAllowlisted: boolean;
  }): string | null;
};
```

Behavioral contract:
- SAFE-only inputs and bounds.
- No overload-selection logic; templates use exact ABI-verified signatures only.
- Disabled if module missing or signature not allowlisted.

## 5) Bundle Hash Contract

Utility module (proposed):
- `apps/web/lib/actions/bundle-hash.ts`

Type contract:
```ts
export function computeActionsHash(
  targets: `0x${string}`[],
  values: bigint[],
  calldatas: `0x${string}`[]
): `0x${string}`;
```

Behavioral contract:
- Must compute `keccak256(encodePacked(["address[]","uint256[]","bytes[]"],[targets,values,calldatas]))`.
- Queue order is strict; no sorting.
