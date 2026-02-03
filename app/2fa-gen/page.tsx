import { TwoFactorPage } from '@/components/two-factor-page';

interface TwoFactorRouteProps {
  searchParams?: Promise<{ key?: string }>;
}

export default async function TwoFactorRoute({ searchParams }: TwoFactorRouteProps) {
  const resolvedParams = await searchParams;
  return <TwoFactorPage initialSecret={resolvedParams?.key ?? ''} />;
}
