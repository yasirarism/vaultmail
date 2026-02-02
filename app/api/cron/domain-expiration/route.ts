import { NextResponse } from 'next/server';
import { refreshDomainExpiration } from '@/lib/domain-expiration';
import { getStoredDomains } from '@/lib/domains';

const getCronSecret = () => process.env.CRON_SECRET?.trim();

export async function GET(req: Request) {
  const secret = getCronSecret();
  if (secret) {
    const header = req.headers.get('x-cron-secret');
    if (header !== secret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const domains = await getStoredDomains();
  const results = await Promise.all(
    domains.map((domain) => refreshDomainExpiration(domain))
  );

  return NextResponse.json({
    updated: results.length,
    domains: results
  });
}
