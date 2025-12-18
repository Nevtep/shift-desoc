import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift DeSoc",
  description: "Modular governance and coordination platform"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
