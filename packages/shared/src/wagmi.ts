import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";

import type { ShiftEnv } from "./env";

export type CreateShiftConfigOptions = {
  env?: ShiftEnv;
};

export function createShiftConfig({ env }: CreateShiftConfigOptions = {}) {
  const projectId =
    env?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    env?.WALLETCONNECT_PROJECT_ID ??
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    process.env.WALLETCONNECT_PROJECT_ID;

  const chains = [base, baseSepolia] as const;

  const transports = chains.reduce<Record<number, ReturnType<typeof http>>>(
    (map, chain) => {
      if (chain.id === base.id) {
        const url = env?.RPC_BASE ?? process.env.RPC_BASE;
        map[chain.id] = http(url ?? chain.rpcUrls.public.http[0]);
      } else if (chain.id === baseSepolia.id) {
        const url = env?.RPC_BASE_SEPOLIA ?? process.env.RPC_BASE_SEPOLIA;
        map[chain.id] = http(url ?? chain.rpcUrls.public.http[0]);
      }
      return map;
    },
    {}
  );

  return createConfig({
    chains,
    transports,
    connectors: [
      injected({ shimDisconnect: true }),
      ...(projectId
        ? [walletConnect({ projectId, showQrModal: true })]
        : [])
    ]
  });
}
