import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Invoice Keeper — Личное дело",
  description: "Система напоминаний о регулярных платежах",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased bg-dossier-bg text-gray-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
