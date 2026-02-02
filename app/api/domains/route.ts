import { NextResponse } from 'next/server';
import { getDomainsWithFallback } from '@/lib/domains';

export async function GET() {
  const domains = await getDomainsWithFallback();
  return NextResponse.json({ domains });
}
