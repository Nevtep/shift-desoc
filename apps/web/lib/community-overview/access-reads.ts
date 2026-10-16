import type { Abi } from "viem";

import accessManagerArtifact from "../../abis/ShiftAccessManager.json" assert { type: "json" };
import type { CachedPublicClient } from "../../hooks/useCachedPublicClient";
import type { CommunityModules } from "../../hooks/useCommunityModules";
import { selectorFromSignature } from "../actions/permission-matrix";
import { ZERO_ADDRESS } from "./constants";
import { ACCESS_WIRING_CHECKS, moduleKeyForTarget, type AccessReadResults } from "./access-inspection";

const ABI = accessManagerArtifact.abi as Abi;

type ReadClient = Pick<CachedPublicClient, "readContract">;

async function safeBigint(read: () => Promise<unknown>): Promise<bigint | null> {
  try {
    const value = await read();
    return typeof value === "bigint" ? value : typeof value === "number" ? BigInt(value) : null;
  } catch {
    return null;
  }
}

/**
 * Chain-only reads mirroring verify-access-wiring.mjs. Any failed or malformed read
 * becomes null so callers fail closed. Independent of the indexer.
 */
export async function readAccessResults(
  client: ReadClient,
  modules: CommunityModules | null
): Promise<AccessReadResults | null> {
  const accessManager = modules?.accessManager;
  const timelock = modules?.timelock;
  if (!modules || !accessManager || !timelock) return null;

  const adminRole = await safeBigint(() =>
    client.readContract({ address: accessManager, abi: ABI, functionName: "ADMIN_ROLE" })
  );

  const functionRoles: AccessReadResults["functionRoles"] = {};
  await Promise.all(
    ACCESS_WIRING_CHECKS.map(async (check, index) => {
      const target = modules[moduleKeyForTarget(check.targetKey)];
      if (!target || target.toLowerCase() === ZERO_ADDRESS) {
        functionRoles[index] = null;
        return;
      }
      functionRoles[index] = await safeBigint(() =>
        client.readContract({
          address: accessManager,
          abi: ABI,
          functionName: "getTargetFunctionRole",
          args: [target, selectorFromSignature(check.signature)]
        })
      );
    })
  );

  // Only ADMIN holder state affects the verdict (as in the script); other roles are selector bindings only.
  const roleIds = new Set<bigint>();
  if (adminRole !== null) roleIds.add(adminRole);

  const timelockHasRole: AccessReadResults["timelockHasRole"] = {};
  await Promise.all(
    [...roleIds].map(async (role) => {
      try {
        const result = await client.readContract<readonly [boolean, number] | boolean>({
          address: accessManager,
          abi: ABI,
          functionName: "hasRole",
          args: [role, timelock]
        });
        const member = Array.isArray(result) ? result[0] : result;
        timelockHasRole[role.toString()] = typeof member === "boolean" ? member : null;
      } catch {
        timelockHasRole[role.toString()] = null;
      }
    })
  );

  return { adminRole, functionRoles, timelockHasRole };
}
