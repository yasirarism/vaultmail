import { NextResponse } from 'next/server';
import { DEFAULT_DOMAINS } from '@/lib/config';
import { refreshDomainExpiration } from '@/lib/domain-expiration';

const getCronSecret = () => process.env.CRON_SECRET?.trim();

export async function GET(req: Request) {
  const secret = getCronSecret();
  if (secret) {
    const header = req.headers.get('x-cron-secret');
    if (header !== secret) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  const results = await Promise.all(
    DEFAULT_DOMAINS.map((domain) => refreshDomainExpiration(domain))
  );

  return NextResponse.json({
    updated: results.length,
    domains: results
  });
}
