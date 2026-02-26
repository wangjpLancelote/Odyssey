import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cinzel } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-title",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Odyssey MVP",
  description: "Longzu-inspired dialogue narrative MVP"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={`h-full overflow-hidden ${cinzel.variable}`}>
      <body className="h-full overflow-hidden bg-[var(--ody-surface-body)] text-[var(--ody-text)] antialiased [font-family:var(--ody-font-serif)]">
        {children}
      </body>
    </html>
  );
}
