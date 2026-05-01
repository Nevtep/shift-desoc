"use client";

import { getI18n } from "../../lib/i18n";

/** Collapsed by default: indexer / sync caveats for builders. */
export function GovernanceTechnicalFooter() {
  const t = getI18n().governance;
  return (
    <details className="rounded-xl border border-border bg-background/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground transition-colors hover:text-primary">
        {t.technicalFooterSummary}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.topBarIndexerHelp}</p>
    </details>
  );
}
