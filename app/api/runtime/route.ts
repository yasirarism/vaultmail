import { NextResponse } from 'next/server';
import { getRuntimeInfo } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getRuntimeInfo(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
