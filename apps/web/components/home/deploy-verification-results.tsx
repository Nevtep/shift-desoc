"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { VerificationCheckResult } from "../../lib/deploy/types";

const FRIENDLY_LABELS: Record<string, string> = {
  MODULE_WIRING_VALUABLE_ACTION_REGISTRY: "Registry de módulos",
  VPT_COMMUNITY_INITIALIZED: "Token de verificación",
  ROLE_RR_POSITION_MANAGER: "Gestor de posiciones",
  ROLE_RR_DISTRIBUTOR: "Distribuidor de ingresos",
  ROLE_COMMERCE_DISPUTES_CALLER: "Resolución de disputas",
  ROLE_HOUSING_MARKETPLACE_CALLER: "Marketplace de vivienda",
  ROLE_VA_ISSUER_REQUEST_HUB: "Centro de solicitudes",
  MARKETPLACE_COMMUNITY_ACTIVE: "Marketplace activo",
  REVENUE_ROUTER_TREASURY_SET: "Tesorería configurada"
};

const VERIFY_CHECK_KEYS = [
  "MODULE_WIRING_VALUABLE_ACTION_REGISTRY",
  "VPT_COMMUNITY_INITIALIZED",
  "ROLE_RR_POSITION_MANAGER",
  "ROLE_RR_DISTRIBUTOR",
  "ROLE_COMMERCE_DISPUTES_CALLER",
  "ROLE_HOUSING_MARKETPLACE_CALLER",
  "ROLE_VA_ISSUER_REQUEST_HUB",
  "MARKETPLACE_COMMUNITY_ACTIVE",
  "REVENUE_ROUTER_TREASURY_SET"
] as const;

type Props = {
  results: VerificationCheckResult[];
  isVerifying?: boolean;
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
              <span className="text-xs text-muted-foreground">Verificando…</span>
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

export function DeployVerificationResults({ results, isVerifying }: Props) {
  const hasResults = results.length > 0;
  const showSection = hasResults || isVerifying;

  if (!showSection) return null;

  const items = hasResults
    ? results
    : VERIFY_CHECK_KEYS.map((key) => ({
        key,
        label: FRIENDLY_LABELS[key] ?? key.replace(/_/g, " "),
        passed: undefined as boolean | undefined
      }));

  return (
    <section className="mx-auto w-full max-w-2xl space-y-2">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((item, i) => (
          <CheckRow
            key={item.key}
            label={FRIENDLY_LABELS[item.key] ?? ("label" in item ? item.label : item.key.replace(/_/g, " "))}
            passed={"passed" in item ? item.passed : undefined}
            failureReason={"failureReason" in item ? item.failureReason : undefined}
            isLoading={isVerifying || !hasResults}
            delayMs={600 + i * 320}
          />
        ))}
      </ul>
    </section>
  );
}

