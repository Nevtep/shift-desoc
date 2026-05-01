import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ProfileOverview } from "../../components/profile/profile-overview";
import { getCanonicalAllowlistMeta } from "../../lib/actions/allowlist";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../../lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const t = getI18n(locale).profilePage;
  return {
    title: t.metaTitle,
    description: t.metaDescription
  };
}

export default async function ProfilePage() {
  const allowlistMeta = getCanonicalAllowlistMeta();
  return (
    <ProfileOverview
      allowlistProfileId={allowlistMeta.profileId}
      allowlistGeneratedAt={allowlistMeta.generatedAt}
      allowlistTargetCount={allowlistMeta.targetCount}
      allowlistSignatureCount={allowlistMeta.signatureCount}
    />
  );
}
