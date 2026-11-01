import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "할 일 관리",
  description: "할 일 → 주간 계획 → 1년 목표",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>
          <header className="bg-black text-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <span className="font-semibold">할 일 관리</span>
              <Nav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
