import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCollections } from '@/lib/mongodb';
import { ADMIN_SESSION_COOKIE, isAdminSessionValid } from '@/lib/admin-auth';

type AdminStats = {
  inboxCount: number;
  messageCount: number;
  latestReceivedAt: string | null;
};

const isAuthorized = async () => {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return isAdminSessionValid(sessionToken);
};

export async function GET() {
  if (!(await isAuthorized())) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { emails } = await getCollections();
  const distinctAddresses = await emails.distinct('address');
  const inboxCount = distinctAddresses.length;

  const messageCount = await emails.countDocuments();
  const latestEmail = await emails.find().sort({ receivedAt: -1 }).limit(1).next();
  const latestReceivedAt = latestEmail?.receivedAt
    ? new Date(latestEmail.receivedAt).toISOString()
    : null;

  const stats: AdminStats = {
    inboxCount,
    messageCount,
    latestReceivedAt
  };

  return NextResponse.json(stats);
}
