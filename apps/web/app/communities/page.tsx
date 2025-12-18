import { CommunityList } from "../../components/communities/community-list";

export const metadata = {
  title: "Communities | Shift"
};

export default function CommunitiesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Communities</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Explore on-chain communities configured with Shift governance infrastructure.
        </p>
      </header>
      <CommunityList />
    </main>
  );
}
