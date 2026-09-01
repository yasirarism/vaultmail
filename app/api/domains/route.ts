import { NextResponse } from 'next/server';
import { getDomainsWithFallback } from '@/lib/domains';
import { authorizeRawApi, unauthorizedResponse } from '@/lib/raw-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await authorizeRawApi(req))) {
    return unauthorizedResponse();
  }
  const domains = await getDomainsWithFallback();
  return NextResponse.json({ domains }, { headers: { 'Cache-Control': 'no-store' } });
}
