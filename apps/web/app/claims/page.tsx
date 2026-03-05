import { EngagementsPageContent } from "../engagements/page";

export const metadata = {
  title: "Engagements | Shift"
};

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClaimsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const communityIdParam = resolvedSearchParams?.communityId;
  const communityId = Array.isArray(communityIdParam) ? communityIdParam[0] : communityIdParam;

  return <EngagementsPageContent communityId={communityId ?? undefined} />;
}
