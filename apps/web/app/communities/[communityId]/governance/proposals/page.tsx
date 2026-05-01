import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { GovernanceTechnicalFooter } from "../../../../../components/layout/governance-technical-footer";
import { ProposalList } from "../../../../../components/governance/proposal-list";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaCommunityProposalsTitle,
    description: t.metaProposalsDescription
  };
}

type PageProps = {
  params: Promise<{
    communityId: string;
  }>;
};

export default async function CommunityProposalsPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const { communityId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.governanceSpaceBadge}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 sm:space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.communityProposalsTitle}</h1>
            <p className="max-w-2xl text-muted-foreground">
              <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-semibold text-secondaryDark ring-1 ring-secondary/25">
                {t.communityBadge.replace("{id}", String(safeCommunityId))}
              </span>
            </p>
          </div>
          <Link className="btn-primary shrink-0" href={`/communities/${safeCommunityId}/governance/proposals/new`}>
            {t.createProposal}
          </Link>
        </div>
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/communities/${safeCommunityId}/governance`}>
          {t.backToGovernanceHub}
        </Link>
      </header>

      <ProposalList
        communityId={safeCommunityId}
        detailHrefBasePath={`/communities/${safeCommunityId}/governance/proposals`}
      />

      <GovernanceTechnicalFooter />
    </main>
  );
}
