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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.proposalDetailKicker}</p>
        <h1 className="text-3xl font-semibold">{t.proposalDetailTitle.replace("{id}", proposalId)}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t.proposalDetailSubtitle}</p>
      </header>
      <ProposalDetail proposalId={proposalId} />
    </main>
  );
}
