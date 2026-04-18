import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { Toaster } from 'sonner';
import AdsenseScript from '@/components/AdsenseScript';
import { getStoredAppName } from '@/lib/branding-settings';

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
  const themeInitScript = `
    try {
      var savedTheme = localStorage.getItem('vaultmail_theme');
      if (savedTheme === 'neomorph') {
        document.documentElement.setAttribute('data-theme', 'neomorph');
      }
    } catch (e) {}
  `;

  return (
    <html lang={DEFAULT_LOCALE} className="dark">
      <body className="font-sans">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <AdsenseScript />
        {children}
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  );
}
