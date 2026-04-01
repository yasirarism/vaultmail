import { HomePage } from "@/components/home-page";
import { HomepageLock } from "@/components/homepage-lock";
import { cookies } from "next/headers";
import {
  getHomepageLockSettings,
  HOMEPAGE_LOCK_COOKIE,
} from "@/lib/homepage-lock";
import { getStoredAppName } from "@/lib/branding-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [settings, appName] = await Promise.all([
    getHomepageLockSettings(),
    getStoredAppName(),
  ]);

  if (!settings.enabled || !settings.passwordHash) {
    return <HomePage />;
  }
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(HOMEPAGE_LOCK_COOKIE);
  const isAuthorized = authCookie?.value === settings.passwordHash;

  if (!isAuthorized) {
    return <HomepageLock appName={appName} />;
  }

  return <HomePage />;
}
