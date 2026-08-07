import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FirebaseConfigGate } from "@/components/layout/FirebaseConfigGate";
import { QuickLinksFloating } from "@/components/layout/QuickLinksFloating";
import { VisitTracker } from "@/components/layout/VisitTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "A.U.R.A 마일리지 | 국립순천대학교 AI인재양성부트캠프사업단";
const DESCRIPTION = "AURA 마일리지 조회, 신청, 중고급 이수 신청을 한 곳에서.";

export const metadata: Metadata = {
  metadataBase: new URL("https://aura.scnuai.com"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://aura.scnuai.com",
    siteName: "A.U.R.A 마일리지",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <FirebaseConfigGate>
          <VisitTracker />
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <QuickLinksFloating />
        </FirebaseConfigGate>
      </body>
    </html>
  );
}
