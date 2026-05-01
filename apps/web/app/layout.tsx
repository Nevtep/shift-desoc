import type { Metadata } from "next";
import { Epilogue, Inter } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";

import Link from "next/link";

import { getEnv } from "@shift/shared";

import { ShiftProviders } from "./providers";
import { NavGovernanceDropdown } from "../components/layout/nav-governance-dropdown";
import { LanguageSelector } from "../components/layout/language-selector";
import { SiteBackground } from "../components/layout/site-background";
import { WalletConnectClient } from "../components/wallet/wallet-connect-client";
import { getI18n, LOCALE_COOKIE_KEY, sanitizeLocale } from "../lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const epilogue = Epilogue({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-epilogue",
});

export const metadata: Metadata = {
  title: "Shift DeSoc",
  description: "Modular governance and coordination platform"
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = sanitizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  const i18n = getI18n(locale);
  const t = i18n.layout;
  const env = getEnv();
  const graphqlUrl =
    env.NEXT_PUBLIC_GRAPHQL_URL ??
    env.GRAPHQL_URL ??
    "http://localhost:42069/graphql";
  const apiBaseUrl =
    env.NEXT_PUBLIC_INDEXER_API_URL ??
    env.INDEXER_API_URL ??
    "http://localhost:42069";

  const missingEnv =
    (!env.NEXT_PUBLIC_GRAPHQL_URL && !env.GRAPHQL_URL) ||
    (!env.NEXT_PUBLIC_INDEXER_API_URL && !env.INDEXER_API_URL);

  return (
    <html lang={t.htmlLang} suppressHydrationWarning className={`${inter.variable} ${epilogue.variable}`}>
      <body>
        <ShiftProviders graphqlUrl={graphqlUrl} apiBaseUrl={apiBaseUrl}>
          <div className="relative flex min-h-screen flex-col">
            <SiteBackground />
            <header className="border-b border-border bg-background/80 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 text-sm">
                <Link
                  href="/"
                  className="flex items-center gap-3 font-semibold transition-opacity hover:opacity-90"
                  aria-label={t.homeAria}
                >
                  <img
                    src="/imagotipo-h.svg"
                    alt="Shift DeSoc"
                    className="h-[83px] w-auto"
                  />
                </Link>
                <div className="flex flex-wrap items-center gap-4">
                  <nav className="flex flex-wrap items-center gap-4 font-bold text-primary">
                    <Link
                      className="cursor-pointer transition-colors hover:text-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href="/communities"
                    >
                      {t.navCommunities}
                    </Link>
                    <NavGovernanceDropdown />
                    <Link
                      className="cursor-pointer transition-colors hover:text-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href="/engagements"
                    >
                      {t.navEngagements}
                    </Link>
                    <Link
                      className="cursor-pointer transition-colors hover:text-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href="/marketplace"
                    >
                      {t.navMarketplace}
                    </Link>
                    <Link
                      className="cursor-pointer transition-colors hover:text-primaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href="/profile"
                    >
                      {t.navProfile}
                    </Link>
                  </nav>
                  <LanguageSelector />
                  <WalletConnectClient showAddress />
                </div>
              </div>
            </header>
            {missingEnv ? (
              <div className="border-b border-destructive/40 bg-destructive/10 text-center text-xs text-destructive">
                {t.missingEnv}
              </div>
            ) : null}
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border bg-background/60">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
                <span>{t.footerTitle}</span>
                <a
                  className="underline"
                  href="https://github.com/Shift-Labs/shift/tree/main/docs"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.footerDocs}
                </a>
              </div>
            </footer>
          </div>
        </ShiftProviders>
      </body>
    </html>
  );
}
