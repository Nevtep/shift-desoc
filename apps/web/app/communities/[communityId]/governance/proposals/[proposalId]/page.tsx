import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ProposalDetail } from "../../../../../../components/governance/proposal-detail";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../../../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;
  return {
    title: t.metaProposalDetailTitle,
    description: t.proposalDetailSubtitle
  };
}

type PageProps = {
  params: Promise<{
    communityId: string;
    proposalId: string;
  }>;
};

export default async function CommunityProposalDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const { communityId, proposalId } = await params;
  const numericCommunityId = Number(communityId);
  const safeCommunityId = Number.isFinite(numericCommunityId) && numericCommunityId > 0 ? numericCommunityId : 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.governanceSpaceBadge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.proposalDetailKicker}</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.proposalDetailTitle.replace("{id}", proposalId)}</h1>
        </div>
        <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/communities/${safeCommunityId}/governance/proposals`}>
          {t.backToProposals}
        </Link>
      </header>

      <ProposalDetail proposalId={proposalId} expectedCommunityId={safeCommunityId} />
    </main>
  );
}
