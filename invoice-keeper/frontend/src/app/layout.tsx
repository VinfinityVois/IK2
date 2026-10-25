import type { Metadata } from "next";
import "./globals.css";
import { Onest } from "next/font/google";
import { cn } from "@/lib/utils";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });

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
    <html lang="ru" className={cn("font-sans", onest.variable)}>
      <body className="antialiased bg-dossier-bg text-gray-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
