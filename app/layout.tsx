import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyFinance — Controle mensal",
  description: "Acompanhe receitas, despesas e descubra para onde seu dinheiro está indo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
