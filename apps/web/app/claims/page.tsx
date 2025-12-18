import Link from "next/link";

export const metadata = {
  title: "Claims | Shift"
};

export default function ClaimsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Claims</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Track valuable actions from submission through juror verification and resolution.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Claims feed will appear once the Ponder handlers are deployed.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/claims/new">
          Submit a claim (upcoming)
        </Link>
        <Link className="underline" href="/profile">
          View your profile
        </Link>
      </div>
    </main>
  );
}
