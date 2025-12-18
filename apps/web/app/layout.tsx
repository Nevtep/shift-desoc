import type { Metadata } from "next";
import "./globals.css";

import { createShiftConfig, getEnv } from "@shift/shared";

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
  const wagmiConfig = createShiftConfig({ env });
  const graphqlUrl =
    env.NEXT_PUBLIC_GRAPHQL_URL ??
    env.GRAPHQL_URL ??
    "http://localhost:4200/graphql";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ShiftProviders wagmiConfig={wagmiConfig} graphqlUrl={graphqlUrl}>
          {children}
        </ShiftProviders>
      </body>
    </html>
  );
}
