import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YS Mail - Secure Disposable Email",
  description: "Self Hosted Temporary email service with custom domains.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} className="dark">
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  );
}
