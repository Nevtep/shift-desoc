"use client";

import Link from "next/link";

import { getI18n } from "../../lib/i18n";

export function GovernanceTopBar({ communityId }: { communityId: number }) {
  const t = getI18n().governance;

  return (
    <header className="space-y-4">
      <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
        {t.communityGovernanceBadge}
      </p>
      <div className="space-y-2 sm:space-y-3">
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t.communityGovernanceTitle.replace("{id}", String(communityId))}
        </h1>
        <p className="max-w-3xl text-muted-foreground">{t.hubSubtitle}</p>
      </div>
      <div>
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/communities/${communityId}`}>
          {t.backToOverview}
        </Link>
      </div>
    </header>
  );
}
