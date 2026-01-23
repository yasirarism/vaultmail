import type { Metadata } from "next";
import "./globals.css";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { Toaster } from 'sonner';
import AdsenseScript from "@/components/AdsenseScript";

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
      <body className="font-sans">
        <AdsenseScript />
        {children}
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  );
}
