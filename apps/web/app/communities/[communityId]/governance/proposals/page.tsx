import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{t.communityProposalsTitle}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-2 py-1 text-xs uppercase tracking-wide">
              {t.communityBadge.replace("{id}", String(safeCommunityId))}
            </span>
            <Link className="btn-primary" href={`/communities/${safeCommunityId}/governance/proposals/new`}>
              {t.createProposal}
            </Link>
          </div>
        </div>
        <div>
          <Link className="text-sm underline" href={`/communities/${safeCommunityId}/governance`}>
            {t.backToGovernanceHub}
          </Link>
        </div>
      </header>

      <ProposalList
        communityId={safeCommunityId}
        detailHrefBasePath={`/communities/${safeCommunityId}/governance/proposals`}
      />
    </main>
  );
}
