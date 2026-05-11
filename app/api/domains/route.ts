import { NextResponse } from 'next/server';
import { getDomainsWithFallback } from '@/lib/domains';

export async function GET() {
  const domains = await getDomainsWithFallback();
  return NextResponse.json({ domains }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
}
