export const metadata = {
  title: "Reservation Detail | Shift"
};

type PageProps = {
  params: {
    reservationId: string;
  };
};

export default function ReservationDetailPage({ params }: PageProps) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservation</p>
        <h1 className="text-3xl font-semibold">Reservation {params.reservationId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Reservation timeline, payment events, and dispute status will appear when the indexer delivers
          housing events.
        </p>
      </header>
      <section className="rounded-lg border border-border p-4 shadow-sm">
        <h2 className="text-lg font-medium">Stay Details</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nightly schedule, participants, and token flows display here once data is available.
        </p>
      </section>
    </main>
  );
}
