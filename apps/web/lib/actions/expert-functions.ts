import type { Abi, AbiFunction, AbiParameter } from "viem";

function formatAbiParamType(param: AbiParameter): string {
  const typeWithComponents = param as AbiParameter & { components?: readonly AbiParameter[] };
  if (param.type === "tuple") {
    const components = Array.isArray(typeWithComponents.components) ? typeWithComponents.components : [];
    return `(${components.map((component) => formatAbiParamType(component)).join(",")})`;
  }
  if (param.type === "tuple[]") {
    const components = Array.isArray(typeWithComponents.components) ? typeWithComponents.components : [];
    return `(${components.map((component) => formatAbiParamType(component)).join(",")})[]`;
  }
  return param.type;
}

export function formatFunctionSignature(fragment: AbiFunction): string {
  return `${fragment.name}(${fragment.inputs.map((input) => formatAbiParamType(input)).join(",")})`;
}

export type AllowlistedFunctionDefinition = {
  signature: string;
  functionName: string;
  abiFragment: AbiFunction;
};

export function getAllowlistedFunctionsForTarget(
  abi: Abi,
  allowlistedSignatures: readonly string[]
): AllowlistedFunctionDefinition[] {
  const mutableFunctions = abi.filter((item): item is AbiFunction => {
    if (item.type !== "function") return false;
    return item.stateMutability === "nonpayable" || item.stateMutability === "payable";
  });

  const bySignature = new Map<string, AbiFunction>();
  for (const fragment of mutableFunctions) {
    bySignature.set(formatFunctionSignature(fragment), fragment);
  }

  return [...allowlistedSignatures]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((signature) => {
      const fragment = bySignature.get(signature);
      if (!fragment) return [];
      return [{
        signature,
        functionName: fragment.name,
        abiFragment: fragment
      }];
    });
}
