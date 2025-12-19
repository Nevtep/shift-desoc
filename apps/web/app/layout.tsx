import type { Metadata } from "next";
import "./globals.css";

import Link from "next/link";

import { getEnv } from "@shift/shared";

import { ShiftProviders } from "./providers";

export const metadata: Metadata = {
  title: "Shift DeSoc",
  description: "Modular governance and coordination platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const env = getEnv();
  const graphqlUrl =
    env.NEXT_PUBLIC_GRAPHQL_URL ??
    env.GRAPHQL_URL ??
    "http://localhost:42069/graphql";
  const apiBaseUrl =
    env.NEXT_PUBLIC_INDEXER_API_URL ??
    env.INDEXER_API_URL ??
    "http://localhost:42069";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ShiftProviders graphqlUrl={graphqlUrl} apiBaseUrl={apiBaseUrl}>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-border bg-background/80 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 text-sm">
                <div className="flex items-center gap-3 font-semibold">
                  <span>Shift DeSoc</span>
                </div>
                <nav className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <Link className="hover:text-foreground" href="/communities">
                    Communities
                  </Link>
                  <Link className="hover:text-foreground" href="/requests">
                    Path A: Requests
                  </Link>
                  <Link className="hover:text-foreground" href="/claims">
                    Path B: Claims
                  </Link>
                  <Link className="hover:text-foreground" href="/marketplace">
                    Path C: Marketplace
                  </Link>
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border bg-background/60">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
                <span>Shift meta-governance</span>
                <a
                  className="underline"
                  href="https://github.com/Shift-Labs/shift/tree/main/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  Docs
                </a>
              </div>
            </footer>
          </div>
        </ShiftProviders>
      </body>
    </html>
  );
}
