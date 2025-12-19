import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-12 text-center">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Shift DeSoc dApp
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Governance, verification, and commerce tooling for modular communities.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link className="underline" href="/communities">
          View communities
        </Link>
        <a
          className="underline"
          href="https://github.com/Shift-Labs/shift/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          Documentation
        </a>
      </div>
    </main>
  );
}
