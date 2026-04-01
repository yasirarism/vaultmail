import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { HomePage } from "@/components/home-page";
import { HomepageLock } from "@/components/homepage-lock";
import {
  getHomepageLockSettings,
  HOMEPAGE_LOCK_COOKIE,
} from "@/lib/homepage-lock";
import { getStoredAppName } from "@/lib/branding-settings";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const address = (await params).address;

  // Simple validation
  const decoded = decodeURIComponent(address);
  if (!decoded.includes('@')) {
    redirect('/');
  }

  const [settings, appName] = await Promise.all([
    getHomepageLockSettings(),
    getStoredAppName(),
  ]);

  if (settings.enabled && settings.passwordHash) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(HOMEPAGE_LOCK_COOKIE);
    const isAuthorized = authCookie?.value === settings.passwordHash;

    if (!isAuthorized) {
      return <HomepageLock appName={appName} />;
    }
  }

  return <HomePage initialAddress={decoded} />;
}
