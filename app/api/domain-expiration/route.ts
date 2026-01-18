import { NextResponse } from 'next/server';
import { getStoredDomainExpiration, refreshDomainExpiration } from '@/lib/domain-expiration';

const MAX_AGE_HOURS = 24;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain')?.toLowerCase();

  if (!domain) {
    return NextResponse.json({ error: 'Domain required' }, { status: 400 });
  }

  const stored = await getStoredDomainExpiration(domain);
  if (stored) {
    const checkedAt = new Date(stored.checkedAt).getTime();
    const ageHours = (Date.now() - checkedAt) / (1000 * 60 * 60);
    if (Number.isFinite(ageHours) && ageHours < MAX_AGE_HOURS) {
      return NextResponse.json(stored);
    }
  }

  const refreshed = await refreshDomainExpiration(domain);
  return NextResponse.json(refreshed);
}
