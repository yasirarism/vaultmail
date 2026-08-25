import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { Toaster } from 'sonner';
import AdsenseScript from '@/components/AdsenseScript';
import { getStoredAppName } from '@/lib/branding-settings';
import { ThemeProvider } from '@/components/theme-provider';
import { buildThemeBootstrapScript } from '@/lib/theme';
import { getStoredDefaultTheme } from '@/lib/theme-settings';

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getStoredAppName();
  return {
    title: `${appName} - Secure Disposable Email`,
    description: 'Self Hosted Temporary email service with custom domains.'
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultTheme = await getStoredDefaultTheme();

  return (
    <html lang={DEFAULT_LOCALE} className="dark" data-theme={defaultTheme} suppressHydrationWarning>
      <body className="font-sans">
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript(defaultTheme) }} />
        <ThemeProvider>
          <AdsenseScript />
          {children}
          <Toaster position="top-right" theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
