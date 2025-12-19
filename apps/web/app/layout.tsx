import type { Metadata } from "next";
import "./globals.css";

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
    "http://localhost:4200/graphql";
  const apiBaseUrl =
    env.NEXT_PUBLIC_INDEXER_API_URL ??
    env.INDEXER_API_URL ??
    "http://localhost:42069";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ShiftProviders graphqlUrl={graphqlUrl} apiBaseUrl={apiBaseUrl}>
          {children}
        </ShiftProviders>
      </body>
    </html>
  );
}
