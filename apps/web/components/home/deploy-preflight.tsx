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
  const accessManagerProbe = sharedInfra.accessManager;
  const paramControllerProbe = sharedInfra.paramController;
  const communityRegistryProbe = sharedInfra.communityRegistry;

  return (
    <section className="card space-y-3">
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
      <div className="card-tight space-y-1 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Shared infra details</p>
        <p>
          AccessManager: {accessManagerProbe?.address ?? "not resolved"} ({accessManagerProbe?.abiProbePassed ? "probe ok" : "probe failed"})
        </p>
        <p>
          ParamController: {paramControllerProbe?.address ?? "not resolved"} ({paramControllerProbe?.abiProbePassed ? "probe ok" : "probe failed"})
        </p>
        <p>
          CommunityRegistry: {communityRegistryProbe?.address ?? "not resolved"} ({communityRegistryProbe?.abiProbePassed ? "probe ok" : "probe failed"})
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
