"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { VerificationCheckResult } from "../../lib/deploy/types";
import { getI18n } from "../../lib/i18n";

const FRIENDLY_LABELS: Record<string, string> = {
  MODULE_WIRING_VALUABLE_ACTION_REGISTRY: "Registry de módulos",
  VPT_COMMUNITY_INITIALIZED: "Token de verificación",
  ROLE_RR_POSITION_MANAGER: "Rol de gestor de posiciones",
  ROLE_VERIFIER_MANAGER_CALLER_ENGAGEMENTS: "Rol de jurados en engagements",
  ROLE_RR_DISTRIBUTOR: "Distribuidor de ingresos",
  ROLE_COMMERCE_DISPUTES_CALLER: "Rol de disputas en marketplace",
  ROLE_COHORT_REVENUE_ROUTER: "Rol de revenue router en cohortes",
  ROLE_HOUSING_MARKETPLACE_CALLER: "Rol de housing en marketplace",
  ROLE_COHORT_INVESTMENT_RECORDER: "Rol de registro de inversion en cohortes",
  ROLE_VA_ISSUER_REQUEST_HUB: "Rol issuer en RequestHub",
  ROLE_VA_ISSUER_POSITION_MANAGER: "Rol issuer en PositionManager",
  ROLE_VA_ISSUER_INVESTMENT_COHORT_MANAGER: "Rol issuer en InvestmentCohortManager",
  ROLE_VA_ISSUER_CREDENTIAL_MANAGER: "Rol issuer en CredentialManager",
  ROLE_MEMBERSHIP_MINTER_ENGAGEMENTS: "Rol minter de membresia en Engagements",
  ROLE_VA_SBT_MANAGER_REGISTRY: "Rol manager SBT en ValuableActionRegistry",
  MARKETPLACE_COMMUNITY_ACTIVE: "Marketplace activo",
  REVENUE_ROUTER_TREASURY_SET: "Tesorería configurada"
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
  const t = getI18n().verification;
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
              <span className="text-xs text-muted-foreground">{t.checking}</span>
            </>
          ) : showResult ? (
            passed ? (
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" aria-hidden />
                {t.pass}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <X className="h-4 w-4" aria-hidden />
                {t.fail}
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

export function DeployVerificationResults({ results, isVerifying }: Props) {
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
        label: FRIENDLY_LABELS[key] ?? key.replace(/_/g, " ")
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
            delayMs={600 + i * 320}
          />
        ))}
      </ul>
    </section>
  );
}

