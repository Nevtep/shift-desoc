"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { VerificationCheckResult } from "../../lib/deploy/types";

const FRIENDLY_LABELS: Record<string, string> = {
  MODULE_WIRING_VALUABLE_ACTION_REGISTRY: "Module registry wiring",
  VPT_COMMUNITY_INITIALIZED: "Verification token initialized",
  ROLE_RR_POSITION_MANAGER: "Position manager role",
  ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS: "Verifier manager caller role (Engagements)",
  ROLE_RR_DISTRIBUTOR: "Revenue distributor role",
  ROLE_COMMERCE_DISPUTES_CALLER: "Commerce disputes caller role",
  ROLE_COHORT_REVENUE_ROUTER: "Cohort revenue router role",
  ROLE_HOUSING_MARKETPLACE_CALLER: "Housing marketplace caller role",
  ROLE_COHORT_INVESTMENT_RECORDER: "Cohort investment recorder role",
  ROLE_VA_ISSUER_REQUEST_HUB: "Issuer role (RequestHub)",
  ROLE_VA_ISSUER_POSITION_MANAGER: "Issuer role (PositionManager)",
  ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER: "Issuer role (InvestmentCohortManager)",
  ROLE_VA_ISSUER_CREDENTIAL_MANAGER: "Issuer role (CredentialManager)",
  ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS: "Membership minter role (Engagements)",
  ROLE_VA_SBT_MANAGER_REGISTRY: "SBT manager role (ValuableActionRegistry)",
  MARKETPLACE_COMMUNITY_ACTIVE: "Marketplace active",
  REVENUE_ROUTER_TREASURY_SET: "Treasury configured"
};

const VERIFY_CHECK_KEYS = [
  "MODULE_WIRING_VALUABLE_ACTION_REGISTRY",
  "VPT_COMMUNITY_INITIALIZED",
  "ROLE_RR_POSITION_MANAGER",
  "ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS",
  "ROLE_RR_DISTRIBUTOR",
  "ROLE_COMMERCE_DISPUTES_CALLER",
  "ROLE_COHORT_REVENUE_ROUTER",
  "ROLE_HOUSING_MARKETPLACE_CALLER",
  "ROLE_COHORT_INVESTMENT_RECORDER",
  "ROLE_VA_ISSUER_REQUEST_HUB",
  "ROLE_VA_ISSUER_POSITION_MANAGER",
  "ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER",
  "ROLE_VA_ISSUER_CREDENTIAL_MANAGER",
  "ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS",
  "ROLE_VA_SBT_MANAGER_REGISTRY",
  "MARKETPLACE_COMMUNITY_ACTIVE",
  "REVENUE_ROUTER_TREASURY_SET"
] as const;

type Props = {
  results: VerificationCheckResult[];
  isVerifying?: boolean;
  revealBaseDelayMs?: number;
  revealStepDelayMs?: number;
};

type DisplayVerificationItem = {
  key: string;
  label: string;
  passed?: boolean;
  failureReason?: string;
};

function CheckRow({
  label,
  passed,
  failureReason,
  isLoading,
  delayMs
}: {
  label: string;
  passed?: boolean;
  failureReason?: string;
  isLoading: boolean;
  delayMs: number;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!isLoading && passed !== undefined) {
      const t = setTimeout(() => setRevealed(true), delayMs);
      return () => clearTimeout(t);
    }
  }, [isLoading, passed, delayMs]);

  const showLoading = isLoading || (passed !== undefined && !revealed);
  const showResult = !isLoading && passed !== undefined && revealed;

  return (
    <li className="rounded-lg border border-border bg-background/80 px-3 py-2 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          {showLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Checking...</span>
            </>
          ) : showResult ? (
            passed ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" aria-hidden />
                Pass
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <X className="h-4 w-4" aria-hidden />
                Fail
              </span>
            )
          ) : null}
        </span>
      </div>
      {showResult && !passed && failureReason ? (
        <p className="mt-1 text-xs text-destructive">{failureReason}</p>
      ) : null}
    </li>
  );
}

export function DeployVerificationResults({
  results,
  isVerifying,
  revealBaseDelayMs = 600,
  revealStepDelayMs = 320
}: Props) {
  const hasResults = results.length > 0;
  const showSection = hasResults || isVerifying;

  if (!showSection) return null;

  const items: DisplayVerificationItem[] = hasResults
    ? results.map((item) => ({
        key: item.key,
        label: item.label,
        passed: item.passed,
        failureReason: item.failureReason
      }))
    : VERIFY_CHECK_KEYS.map((key) => ({
        key,
        label: FRIENDLY_LABELS[key] ?? "Verification check"
      }));

  return (
    <section className="mx-auto w-full max-w-2xl space-y-2">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <CheckRow
            key={item.key}
            label={FRIENDLY_LABELS[item.key] ?? item.label}
            passed={item.passed}
            failureReason={item.failureReason}
            isLoading={isVerifying || !hasResults}
            delayMs={revealBaseDelayMs + i * revealStepDelayMs}
          />
        ))}
      </ul>
    </section>
  );
}

