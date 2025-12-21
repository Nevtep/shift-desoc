export type RequestDetailBodyProps = {
  cid?: string | null;
  hasRequestHubConfig: boolean;
  isIpfsLoading: boolean;
  isIpfsError: boolean;
  ipfsHtml?: string | null;
  onRetryIpfs: () => void;
};

export function RequestDetailBody({
  cid,
  hasRequestHubConfig,
  isIpfsLoading,
  isIpfsError,
  ipfsHtml,
  onRetryIpfs
}: RequestDetailBodyProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Discussion</h2>
        {!hasRequestHubConfig ? (
          <span className="text-xs text-destructive">Unsupported network. Switch to Base Sepolia to view and post.</span>
        ) : null}
        {cid ? (
          <a className="text-xs underline" href={`https://gateway.pinata.cloud/ipfs/${cid}`} target="_blank" rel="noreferrer">
            View original document
          </a>
        ) : null}
      </div>
      {isIpfsLoading ? (
        <p className="text-sm text-muted-foreground">Loading content…</p>
      ) : isIpfsError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">Failed to load IPFS content.</p>
          <button className="text-xs underline" onClick={() => void onRetryIpfs()}>
            Retry
          </button>
        </div>
      ) : ipfsHtml ? (
        <article
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: ipfsHtml }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No IPFS body was provided for this request. Ask the author to re-publish the markdown content if needed.
        </p>
      )}
    </section>
  );
}
