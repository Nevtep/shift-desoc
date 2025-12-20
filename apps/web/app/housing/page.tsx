import Link from "next/link";

export const metadata = {
  title: "Housing | Shift"
};

export default function HousingPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Housing</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Co-housing calendars, investor pools, and worker discounts will surface here after data wiring.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Housing availability feed coming soon.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/housing/reservations">
          View reservations
        </Link>
        <Link className="underline" href="/marketplace">
          Back to marketplace
        </Link>
      </div>
    </main>
  );
}
