import Link from "next/link";

export const metadata = {
  title: "Housing Reservations | Shift"
};

export default function HousingReservationsPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Housing Reservations</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Reservation status, pricing, and occupancy metrics will appear here once marketplace indexing is
          complete.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Reservation data pending indexer rollout.
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/housing">
          Back to housing overview
        </Link>
      </div>
    </main>
  );
}
