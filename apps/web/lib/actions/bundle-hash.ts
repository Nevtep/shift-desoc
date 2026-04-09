import { encodePacked, keccak256, type Address, type Hex } from "viem";

export function computeActionsHash(
  targets: Address[],
  values: bigint[],
  calldatas: Hex[]
): Hex {
  return keccak256(encodePacked(["address[]", "uint256[]", "bytes[]"], [targets, values, calldatas]));
}
