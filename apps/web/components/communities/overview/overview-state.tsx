export function OverviewState({
  type,
  onRetry
}: {
  type: "not-found" | "partial-failure";
  onRetry?: () => void;
}) {
  const title = type === "not-found" ? "Community not found" : "Partial data unavailable";
  const description =
    type === "not-found"
      ? "This community could not be resolved from on-chain sources."
      : "Some on-chain reads failed. Available sections are still shown with unavailable markers.";

  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <button className="btn-outline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}
