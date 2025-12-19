import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";

import type { Config as WagmiConfig } from "wagmi";

import type { ShiftEnv } from "./env";

export type CreateShiftConfigOptions = {
  env?: ShiftEnv;
};

export function createShiftConfig({ env }: CreateShiftConfigOptions = {}): WagmiConfig {
  const projectId =
    env?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    env?.WALLETCONNECT_PROJECT_ID ??
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    process.env.WALLETCONNECT_PROJECT_ID;

  const chains = [base, baseSepolia] as const;

  const transports = chains.reduce<Record<number, ReturnType<typeof http>>>(
    (map, chain) => {
      const defaultRpc = chain.rpcUrls?.default?.http?.[0];
      const publicRpc = (chain.rpcUrls as { public?: { http?: readonly string[] } }).public?.http?.[0];

      if (chain.id === base.id) {
        const url = env?.RPC_BASE ?? process.env.RPC_BASE ?? publicRpc ?? defaultRpc;
        if (!url) {
          throw new Error("RPC URL missing for Base chain");
        }
        map[chain.id] = http(url);
      } else if (chain.id === baseSepolia.id) {
        const url =
          env?.RPC_BASE_SEPOLIA ??
          process.env.RPC_BASE_SEPOLIA ??
          publicRpc ??
          defaultRpc;
        if (!url) {
          throw new Error("RPC URL missing for Base Sepolia chain");
        }
        map[chain.id] = http(url);
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
