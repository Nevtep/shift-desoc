import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ProposalDetail } from "../../../../components/governance/proposal-detail";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../../../lib/i18n";

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
    proposalId: string;
  }>;
};

export default async function ProposalDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).governance;

  const { proposalId } = await params;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-6 py-10 sm:py-12">
      <header className="space-y-4">
        <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          {t.governanceSpaceBadge}
        </p>
        <div className="space-y-2 sm:space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.proposalDetailKicker}</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.proposalDetailTitle.replace("{id}", proposalId)}</h1>
          <p className="max-w-3xl text-muted-foreground">{t.proposalDetailSubtitle}</p>
        </div>
      </header>
      <ProposalDetail proposalId={proposalId} />
    </main>
  );
}
