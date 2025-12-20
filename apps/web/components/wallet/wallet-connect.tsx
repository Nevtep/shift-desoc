"use client";

import { useMemo } from "react";
import {
  useAccount,
  useChainId,
  useChains,
  useConnect,
  useDisconnect,
  useSwitchChain
} from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

const preferredChainIds = new Set<number>([base.id, baseSepolia.id]);

function formatAddress(address?: string | null) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnect() {
  const { address, status: accountStatus } = useAccount();
  const isConnected = accountStatus === "connected";

  const { connectors, connect, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chains = useChains();
  const chainId = useChainId();
  const {
    chains: switchableChains,
    switchChain,
    error: switchError,
    isPending: isSwitching
  } = useSwitchChain();

  const activeChain = useMemo(() => chains.find((chain) => chain.id === chainId), [chains, chainId]);
  const allowedChains = useMemo(
    () => switchableChains.filter((chain) => preferredChainIds.has(chain.id)),
    [switchableChains]
  );
  const showChainWarning = activeChain ? !preferredChainIds.has(activeChain.id) : false;

  if (!isConnected) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {connectors.map((connector) => {
          const isConnectorPending = isPending;
          return (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              disabled={isConnectorPending}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:border-primary disabled:opacity-60"
              type="button"
            >
              {isConnectorPending ? "Connecting..." : `Connect ${connector.name}`}
            </button>
          );
        })}
        {connectError ? (
          <span className="text-xs text-destructive">
            {"message" in connectError ? connectError.message : "Connection failed"}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-border px-3 py-1">
        <span className="text-xs text-muted-foreground">
          {activeChain ? activeChain.name : "No network"}
        </span>
        {allowedChains.map((chain) => {
          const isActive = chain.id === activeChain?.id;
          const isPendingSwitch = isSwitching;
          return (
            <button
              key={chain.id}
              type="button"
              onClick={() => switchChain?.({ chainId: chain.id })}
              disabled={isActive || isPendingSwitch}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium hover:bg-muted/70 disabled:opacity-60"
            >
              {isActive ? "Selected" : isPendingSwitch ? "Switching..." : chain.name}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1">
        <span className="font-mono text-xs">{formatAddress(address) || "Connected"}</span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          Disconnect
        </button>
      </div>
      {showChainWarning ? (
        <span className="text-[11px] text-destructive">
          Switch to Base Sepolia for default interactions.
        </span>
      ) : null}
      {switchError ? (
        <span className="text-[11px] text-destructive">
          {"message" in switchError ? switchError.message : "Failed to switch chain"}
        </span>
      ) : null}
    </div>
  );
}
