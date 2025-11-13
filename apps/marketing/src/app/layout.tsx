import type { Metadata } from "next";
import "../styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shift - Plataforma de Gobernanza On-Chain",
  description: "Plataforma descentralizada para gobernanza comunitaria con votación multi-opción, tokens respaldados y sistema de verificación de trabajo.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
