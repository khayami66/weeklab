import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Header from "@/components/Header";
import SideNav from "@/components/SideNav";
import MobileNav from "@/components/MobileNav";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Weeklab",
  description: "小学校教員向け週案作成支援アプリ",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        <Header />
        <div className="flex flex-1">
          <SideNav />
          <main className="flex-1 p-6">{children}</main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
