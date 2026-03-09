import type { PreflightAssessment } from "../../lib/deploy/types";

type Props = {
  assessment: PreflightAssessment | null;
};

function weiToEth(wei: bigint): string {
  return `${Number(wei) / 1e18}`;
}

export function DeployPreflight({ assessment }: Props) {
  if (!assessment) {
    return <p className="text-sm text-muted-foreground">Run preflight to validate requirements.</p>;
  }

  const { funding, sharedInfra } = assessment;

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="text-base font-semibold">Preflight</h3>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p>
          Wallet: {assessment.walletConnected ? "connected" : "disconnected"}
        </p>
        <p>
          Network: {assessment.supportedNetwork ? "supported" : "unsupported"}
        </p>
        <p>
          Shared infra: {sharedInfra.isUsable ? "ready" : "missing / invalid"}
        </p>
        <p>
          Funds: {funding.isSufficient ? "sufficient" : "insufficient"}
        </p>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Required: {weiToEth(funding.requiredWei)} ETH</p>
        <p>Current: {weiToEth(funding.currentBalanceWei)} ETH</p>
      </div>
      <div className="space-y-1 rounded border border-border p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Shared infra details</p>
        <p>
          AccessManager: {sharedInfra.accessManager.address ?? "not resolved"} ({sharedInfra.accessManager.abiProbePassed ? "probe ok" : "probe failed"})
        </p>
        <p>
          ParamController: {sharedInfra.paramController.address ?? "not resolved"} ({sharedInfra.paramController.abiProbePassed ? "probe ok" : "probe failed"})
        </p>
        <p>
          CommunityRegistry: {sharedInfra.communityRegistry.address ?? "not resolved"} ({sharedInfra.communityRegistry.abiProbePassed ? "probe ok" : "probe failed"})
        </p>
      </div>
      {assessment.blockingReasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
          {assessment.blockingReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-emerald-600">All deployment prerequisites passed.</p>
      )}
    </section>
  );
}
