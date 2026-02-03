import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { HomePage } from "@/components/home-page";
import { HomepageLock } from "@/components/homepage-lock";
import {
  getHomepageLockSettings,
  HOMEPAGE_LOCK_COOKIE,
} from "@/lib/homepage-lock";

export default async function Page({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const address = (await params).address;

  // Simple validation
  const decoded = decodeURIComponent(address);
  if (!decoded.includes("@")) {
    redirect("/");
  }

  const settings = await getHomepageLockSettings();
  if (settings.enabled && settings.passwordHash) {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get(HOMEPAGE_LOCK_COOKIE);
    const isAuthorized = authCookie?.value === settings.passwordHash;

    if (!isAuthorized) {
      return <HomepageLock />;
    }
  }

  return <HomePage initialAddress={decodeURIComponent(address)} />;
}
