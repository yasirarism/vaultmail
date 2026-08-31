import { NextResponse } from 'next/server';
import { getInboxEmails } from '@/lib/inbox-service';
import { authenticateApiRequest } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * PUBLIC API (v1). Requires a valid API key via Authorization: Bearer <key>.
 * OpenAI-style: curl -H "Authorization: Bearer sk-vm-xxx..." ...
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid API key via Authorization: Bearer <key>' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const forceResync = searchParams.get('resync') === '1';

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const result = await getInboxEmails(address, forceResync);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('V1 Inbox Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, checkedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}