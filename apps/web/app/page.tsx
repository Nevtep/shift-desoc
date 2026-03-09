import Link from "next/link";

import { CommunityList } from "../components/communities/community-list";
import { DeployWizard } from "../components/home/deploy-wizard";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
      <header className="space-y-3 text-center sm:text-left">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Shift DeSoc dApp</h1>
        <p className="max-w-2xl text-muted-foreground">
          Governance, verification, and commerce tooling for modular communities.
        </p>
      </header>

      <DeployWizard />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Communities</p>
            <h2 className="text-xl font-semibold">Indexed communities</h2>
          </div>
          <Link className="text-sm underline" href="/communities">
            Open communities page
          </Link>
        </div>
        <CommunityList />
      </section>
    </main>
  );
}
