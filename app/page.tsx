import { HomePage } from "@/components/home-page";
import { HomepageLock } from "@/components/homepage-lock";
import { cookies } from "next/headers";
import crypto from "crypto";

export default async function Home() {
  const homepagePassword = process.env.HOMEPAGE_PASSWORD?.trim();

  if (!homepagePassword) {
    return <HomePage />;
  }

  const expectedHash = crypto
    .createHash('sha256')
    .update(homepagePassword)
    .digest('hex');
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('vaultmail_homepage_auth');
  const isAuthorized = authCookie?.value === expectedHash;

  if (!isAuthorized) {
    return <HomepageLock />;
  }

  return <HomePage />;
}
