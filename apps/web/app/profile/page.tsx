export const metadata = {
  title: "Profile | Shift"
};

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Your Profile</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Governance power, claim history, and marketplace activity will populate here after wallet
          connection and GraphQL hooks are wired.
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Connect your wallet to see personalized stats (coming soon).
      </div>
    </main>
  );
}
