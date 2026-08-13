import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { Toaster } from 'sonner';
import AdsenseScript from '@/components/AdsenseScript';
import { getStoredAppName } from '@/lib/branding-settings';
import { ThemeProvider } from '@/components/theme-provider';
import { DEFAULT_THEME, THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getStoredAppName();
  return {
    title: `${appName} - Secure Disposable Email`,
    description: 'Self Hosted Temporary email service with custom domains.'
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} className="dark" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <body className="font-sans">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <ThemeProvider>
          <AdsenseScript />
          {children}
          <Toaster position="top-right" theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
