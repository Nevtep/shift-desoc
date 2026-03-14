"use client";

import { ChevronDown, Copy, Puzzle, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiCoinbase, SiWalletconnect } from "react-icons/si";
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

function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />;
}

function WalletIcon({ connectorId, connectorName, className }: { connectorId?: string; connectorName?: string; className?: string }) {
  const id = (connectorId ?? "").toLowerCase();
  const name = (connectorName ?? "").toLowerCase();

  const iconClass = "h-6 w-6 text-primary";
  if (id.includes("metamask") || name.includes("metamask")) {
    return (
      <span className={className} title="MetaMask">
        <Wallet className={iconClass} aria-hidden />
      </span>
    );
  }
  if (id.includes("walletconnect") || name.includes("walletconnect")) {
    return (
      <span className={className} title="WalletConnect">
        <SiWalletconnect className={iconClass} aria-hidden />
      </span>
    );
  }
  if (id.includes("coinbase") || name.includes("coinbase")) {
    return (
      <span className={className} title="Coinbase Wallet">
        <SiCoinbase className={iconClass} aria-hidden />
      </span>
    );
  }
  if (id.includes("injected") || name.includes("injected") || name === "browser" || name === "browser wallet") {
    return (
      <span className={className} title="Browser Wallet / Extension">
        <Puzzle className={iconClass} aria-hidden />
      </span>
    );
  }
  return (
    <span className={className} title="Wallet">
      <Wallet className={iconClass} aria-hidden />
    </span>
  );
}

export function WalletConnect() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSwitchChain(chainId: number) {
    switchChain?.({ chainId });
  }

  function handleDisconnect() {
    disconnect();
    setIsOpen(false);
  }

  if (!mounted) {
    return <div className="h-10" aria-hidden />;
  }

  if (!isConnected) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          disabled={isPending}
          className="flex cursor-pointer items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          style={{ backgroundImage: "linear-gradient(135deg, #e09b3f 0%, #dd8649 100%)" }}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
          <ChevronIcon open={isOpen} />
        </button>
        {isOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 min-w-[220px] rounded-[8px] border border-border bg-background py-2 shadow-lg"
            role="menu"
          >
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                type="button"
                onClick={() => {
                  connect({ connector });
                  setIsOpen(false);
                }}
                disabled={isPending}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-muted disabled:opacity-60"
                role="menuitem"
              >
                <WalletIcon connectorId={connector.id} connectorName={connector.name} className="shrink-0" />
                {connector.name}
              </button>
            ))}
            {connectError ? (
              <p className="px-4 py-2 text-xs text-destructive">
                {"message" in connectError ? connectError.message : "Connection failed"}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {showChainWarning ? (
        <span className="text-[11px] text-destructive">Switch to Base Sepolia</span>
      ) : null}
      {switchError ? (
        <span className="text-[11px] text-destructive">
          {"message" in switchError ? switchError.message : "Failed to switch"}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex size-10 cursor-pointer items-center justify-center rounded-[8px] text-white transition-all hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        style={{ backgroundImage: "linear-gradient(135deg, #e09b3f 0%, #dd8649 100%)" }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Wallet connected"
      >
        <Wallet className="h-5 w-5" aria-hidden />
      </button>
      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[420px] rounded-[8px] border border-border bg-background py-2 shadow-lg"
          role="menu"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Connected</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <span className="min-w-0 break-all font-mono text-sm text-foreground">{address}</span>
              <button
                type="button"
                onClick={handleCopyAddress}
                className="shrink-0 flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                aria-label="Copy address"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Network</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowedChains.map((chain) => {
                const isActive = chain.id === activeChain?.id;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => handleSwitchChain(chain.id)}
                    disabled={isActive || isSwitching}
                    className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted/80 disabled:opacity-60"
                  >
                    {isActive ? "✓ " : ""}
                    {chain.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-2 py-1">
            <button
              type="button"
              onClick={handleDisconnect}
              className="btn-primary-pill w-full justify-center"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
