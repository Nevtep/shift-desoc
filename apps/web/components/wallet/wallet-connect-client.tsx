"use client";

import { useEffect, useState } from "react";

import { WalletConnect } from "./wallet-connect";

type WalletConnectClientProps = {
  showAddress?: boolean;
};

export function WalletConnectClient({ showAddress }: WalletConnectClientProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <WalletConnect showAddress={showAddress} />;
}
