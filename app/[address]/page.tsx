import { redirect } from "next/navigation";
import { HomePage } from "@/components/home-page";

export default async function Page({
    params,
  }: {
    params: Promise<{ address: string }>
  }) {
  const address = (await params).address;

  // Simple validation
  const decoded = decodeURIComponent(address);
  if (!decoded.includes('@')) {
      redirect('/');
  }

  return <HomePage initialAddress={decodeURIComponent(address)} />;
}
