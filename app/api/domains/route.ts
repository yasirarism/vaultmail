import { NextResponse } from 'next/server';
import { getDomainsWithFallback } from '@/lib/domains';
export const runtime = 'edge';

export async function GET() {
  const domains = await getDomainsWithFallback();
  return NextResponse.json({ domains });
}
