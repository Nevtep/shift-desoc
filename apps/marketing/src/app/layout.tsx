import type { Metadata } from "next";
import { Epilogue, Inter } from "next/font/google";
import { TamaguiProvider } from "../providers/tamagui/TamaguiProvider";
import { I18nProvider } from "../providers/i18n/I18nContext";
import { getLanguage } from "../providers/i18n/server";
import "./globals.css";

const metadataBase =
  process.env.NEXT_PUBLIC_SITE_URL !== undefined
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined;

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

const siteTitle = "Shift - Plataforma de Gobernanza On-Chain";
const siteDescription =
  "Plataforma descentralizada para gobernanza comunitaria con votación multi-opción, tokens respaldados y sistema de verificación de trabajo.";
const siteName = "Shift DeSoc";
const siteKeywords = [
  "gobernanza on-chain",
  "gobernanza descentralizada",
  "votación multiopción",
  "tokens respaldados",
  "verificación de trabajo",
  "cooperación comunitaria",
  "reputación digital",
  "dao",
  "web3",
];
const ogImage = "/hero-backgound.webp";

export const metadata: Metadata = {
  metadataBase,
  title: siteTitle,
  description: siteDescription,
  applicationName: "Shift",
  generator: "Next.js",
  keywords: siteKeywords,
  authors: [{ name: "Shift Team" }],
  creator: "Shift",
  publisher: "Shift",
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName,
    images: [
      {
        url: ogImage,
        width: 1920,
        height: 1080,
        alt: siteTitle,
      },
    ],
    locale: "es_ES",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: ogImage, alt: siteTitle }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
    apple: ["/favicon.ico"],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const language = await getLanguage();

  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} ${epilogue.variable}`} suppressHydrationWarning>
        <TamaguiProvider>
          <I18nProvider initialLanguage={language}>{children}</I18nProvider>
        </TamaguiProvider>
      </body>
    </html>
  );
}
