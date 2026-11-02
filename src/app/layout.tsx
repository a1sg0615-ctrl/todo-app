import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";
import "./globals.css";

// 디자인 가이드의 전용 서체 대신 권장 대체 서체인 Inter를 쓴다. 한글은 시스템 한글 서체로 표시된다.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "할 일 관리",
  description: "할 일 → 주간 계획 → 1년 목표",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <Providers>
          <header className="border-b border-hairline bg-canvas">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <Nav />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
