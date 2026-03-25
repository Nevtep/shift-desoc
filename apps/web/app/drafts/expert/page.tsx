import Link from "next/link";

import { DraftCreateForm } from "../../../components/drafts/draft-create-form";

export const metadata = {
  title: "Drafts Expert Composer | Shift"
};

export default function DraftsExpertPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Drafts expert composer</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Raw ABI mode exposes all mutable contract functions. Use guided mode unless you need custom calldata.
        </p>
        <Link className="text-sm underline" href="/drafts">
          Back to guided mode
        </Link>
      </header>

      <DraftCreateForm mode="expert" guidedHref="/drafts" />
    </main>
  );
}
