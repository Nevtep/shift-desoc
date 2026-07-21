export const metadata = {
  title: "Reservation Detail (Coming Soon) | Shift"
};

type PageProps = {
  params: Promise<{
    reservationId: string;
  }>;
};

export default async function ReservationDetailPage({ params }: PageProps) {
  const { reservationId } = await params;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservation</p>
        <h1 className="text-3xl font-semibold">Reservation {reservationId}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          This detail route is still a placeholder in Manager. Reservation timeline, payment events, and
          dispute status are not yet operable here.
        </p>
      </header>
      <section className="card">
        <h2 className="text-lg font-medium">What is still gated</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nightly schedule, participants, token flows, and reservation actions stay unavailable until
          housing projections and Manager read surfaces exist.
        </p>
      </section>
    </main>
  );
}
