import { inboxKey } from '@/lib/storage-keys';
import { storage } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { getInboxEmails } from '@/lib/inbox-service';

export const dynamic = 'force-dynamic';

/**
 * INTERNAL route used by the web UI. No API key required —
 * the public developer API lives under /api/v1/* with key auth.
 */
export async function GET(req: Request) {
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
    console.error('Inbox Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown inbox error';
    return NextResponse.json(
      { emails: [], imapError: true, imapMessage: message, checkedAt: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const emailId = searchParams.get('emailId');

  if (!address || !emailId) {
    return NextResponse.json(
      { error: 'Address and emailId required' },
      { status: 400 }
    );
  }

  try {
    const deleted = await storage.ldeleteByIds(inboxKey(address), [emailId]);
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Inbox delete error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
