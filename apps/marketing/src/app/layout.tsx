import type { Metadata } from "next";
import { Epilogue, Inter } from "next/font/google";
import { TamaguiProvider } from "../providers/tamagui/TamaguiProvider";
import { I18nProvider } from "../providers/i18n/I18nContext";
import { getLanguage } from "../providers/i18n/server";
import "./globals.css";

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
  title: "Shift - Plataforma de Gobernanza On-Chain",
  description:
    "Plataforma descentralizada para gobernanza comunitaria con votación multi-opción, tokens respaldados y sistema de verificación de trabajo.",
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
      </head>
      <body className={`${inter.variable} ${epilogue.variable}`} suppressHydrationWarning>
        <TamaguiProvider>
          <I18nProvider initialLanguage={language}>{children}</I18nProvider>
        </TamaguiProvider>
      </body>
    </html>
  );
}
