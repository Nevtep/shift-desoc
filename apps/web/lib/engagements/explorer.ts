export function txExplorerUrl(chainId: number, txHash: string): string {
  const base = chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${base}/tx/${txHash}`;
}
