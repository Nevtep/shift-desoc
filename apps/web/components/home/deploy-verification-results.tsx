import type { VerificationCheckResult } from "../../lib/deploy/types";

type Props = {
  results: VerificationCheckResult[];
};

export function DeployVerificationResults({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <section className="card space-y-3">
      <h3 className="text-base font-semibold">Verification Results</h3>
      <ul className="space-y-2 text-sm">
        {results.map((result) => (
          <li key={result.key} className="card-tight">
            <div className="flex items-center justify-between gap-2">
              <span>{result.label}</span>
              <span className={result.passed ? "text-emerald-600" : "text-destructive"}>
                {result.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            {!result.passed && result.failureReason ? (
              <p className="mt-1 text-xs text-destructive">{result.failureReason}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
