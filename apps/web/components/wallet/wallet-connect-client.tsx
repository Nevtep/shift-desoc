"use client";

import { useEffect, useState } from "react";

import { WalletConnect } from "./wallet-connect";

export function WalletConnectClient() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <WalletConnect />;
}
