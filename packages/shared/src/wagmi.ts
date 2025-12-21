import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { walletConnect } from "wagmi/connectors";

import type { Config as WagmiConfig } from "wagmi";

import type { ShiftEnv } from "./env";

export type CreateShiftConfigOptions = {
  env?: ShiftEnv;
};

export function createShiftConfig({ env }: CreateShiftConfigOptions = {}): WagmiConfig {
  const isBrowser = typeof window !== "undefined";

  const projectId =
    env?.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    env?.WALLETCONNECT_PROJECT_ID ??
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    process.env.WALLETCONNECT_PROJECT_ID;

  // Base Sepolia is the supported network for this build; add Base mainnet when deployments are ready.
  const chains = [baseSepolia] as const;

  const transports = chains.reduce<Record<number, ReturnType<typeof http>>>(
    (map, chain) => {
      const defaultRpc = chain.rpcUrls?.default?.http?.[0];
      const publicRpc = (chain.rpcUrls as { public?: { http?: readonly string[] } }).public?.http?.[0];

      if (chain.id === baseSepolia.id) {
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

  const connectors = [injected({ shimDisconnect: true })];

  // Avoid initializing WalletConnect core on the server (SSR/edge) to prevent duplicate cores
  // and Fast Refresh re-initialization warnings.
  if (projectId && isBrowser) {
    connectors.push(walletConnect({ projectId, showQrModal: true }));
  }

  return createConfig({
    chains,
    transports,
    connectors
  });
}
