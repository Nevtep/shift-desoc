import type { AccessHolderState, AccessInspection, AccessSignal } from "../../../lib/community-overview/access-inspection";
import { formatModuleAddress } from "../../../lib/community-overview/formatters";

const SIGNAL_LABEL: Record<AccessSignal, string> = {
  pass: "verified",
  fail: "mismatch",
  unavailable: "unavailable"
};

const SIGNAL_CLASS: Record<AccessSignal, string> = {
  pass: "text-emerald-700",
  fail: "text-red-700",
  unavailable: "text-amber-700"
};

const HOLDER_LABEL: Record<AccessHolderState, string> = {
  holds_admin: "holds ADMIN",
  no_admin: "does not hold ADMIN",
  unavailable: "unavailable",
  not_checked: "not checked",
  address_only: ""
};

export function AccessSummary({ inspection, loading }: { inspection: AccessInspection; loading: boolean }) {
  const overallLabel = loading ? "checking" : SIGNAL_LABEL[inspection.overall];
  const overallClass = loading ? "text-muted-foreground" : SIGNAL_CLASS[inspection.overall];
  const problems = inspection.rows.filter((row) => row.status !== "pass");

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">Role &amp; access verification</h2>
      <p className="text-sm">
        Access wiring: <span data-testid="access-overall" className={overallClass}>{overallLabel}</span>
      </p>
      <p className="text-sm">
        Timelock holds ADMIN role:{" "}
        <span data-testid="access-timelock-admin" className={loading ? "text-muted-foreground" : SIGNAL_CLASS[inspection.timelockAdmin]}>
          {loading ? "checking" : SIGNAL_LABEL[inspection.timelockAdmin]}
        </span>
      </p>
      <ul className="space-y-1" data-testid="access-holders">
        {inspection.holders.map((holder) => (
          <li key={holder.key} data-testid={`access-holder-${holder.key}`} className="text-xs">
            <span className="font-medium">{holder.label}</span>{" "}
            {holder.address ? <span className="font-mono">{holder.address}</span> : null}{" "}
            {holder.state === "address_only" ? null : (
              <span>{loading ? "checking" : HOLDER_LABEL[holder.state]}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {inspection.rows.length - problems.length}/{inspection.rows.length} selector-role bindings verified on-chain (same rules as
        verify-access-wiring).
      </p>
      {!loading && problems.length > 0 ? (
        <ul className="space-y-1">
          {problems.map((row) => (
            <li key={`${row.targetKey}:${row.signature}`} className="rounded-lg border border-border px-3 py-1 text-xs">
              <span className="font-medium">{row.targetKey}</span> {formatModuleAddress(row.target)}{" "}
              <span className="font-mono">{row.signature}</span>{" "}
              <span className={SIGNAL_CLASS[row.status]}>
                {SIGNAL_LABEL[row.status]} (expected role {row.expectedRole ?? "?"}, actual {row.actualRole ?? "?"})
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
