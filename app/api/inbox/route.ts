import { getCollections } from '@/lib/mongodb';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    const { emails } = await getCollections();
    const normalizedAddress = address.toLowerCase();
    const results = await emails
      .find({ address: normalizedAddress })
      .sort({ receivedAt: -1 })
      .toArray();
    const mapped = results.map((email) => ({
      id: email.id,
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments: email.attachments ?? [],
      receivedAt: email.receivedAt.toISOString(),
      read: email.read
    }));
    return NextResponse.json({ emails: mapped });
  } catch (error) {
    console.error('Inbox Error:', error);
    return NextResponse.json({ emails: [] }, { status: 200 });
  }
}
