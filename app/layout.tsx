import type { Metadata } from 'next';
import './globals.css';
import { DEFAULT_LOCALE } from '@/lib/i18n';
import { Toaster } from 'sonner';
import AdsenseScript from '@/components/AdsenseScript';
import { storage } from '@/lib/storage';
import { BRANDING_SETTINGS_KEY } from '@/lib/admin-auth';
import { DEFAULT_APP_NAME, normalizeAppName } from '@/lib/branding';

type BrandingSettings = {
  appName?: string;
};

const resolveAppName = async () => {
  if (!process.env.MONGODB_URI) {
    return DEFAULT_APP_NAME;
  }
  const stored = await storage.get(BRANDING_SETTINGS_KEY);
  let rawName = '';
  if (typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored) as BrandingSettings;
      rawName = parsed?.appName ?? '';
    } catch {
      rawName = '';
    }
  } else if (typeof stored === 'object' && stored) {
    rawName = (stored as BrandingSettings).appName ?? '';
  }
  return normalizeAppName(rawName) || DEFAULT_APP_NAME;
};

export async function generateMetadata(): Promise<Metadata> {
  const appName = await resolveAppName();
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
    <html lang={DEFAULT_LOCALE} className="dark">
      <body className="font-sans">
        <AdsenseScript />
        {children}
        <Toaster position="top-right" theme="dark" />
      </body>
    </html>
  );
}
