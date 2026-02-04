import { NextResponse } from 'next/server';

type BreachDetail = {
  breach?: string;
  details?: string;
  domain?: string;
  industry?: string;
  logo?: string;
  password_risk?: string;
  references?: string;
  searchable?: string;
  verified?: string;
  xposed_data?: string;
  exposed_data?: string;
  exposed_date?: string;
  exposed_records?: number;
  added?: string;
};

const normalizeResponse = (data: unknown) => {
  const record = data as {
    BreachesSummary?: { site?: string | null };
    ExposedBreaches?: { breaches_details?: BreachDetail[] | null };
  };
  const site = record?.BreachesSummary?.site?.trim() ?? '';
  const breaches = site
    ? site
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const details = Array.isArray(record?.ExposedBreaches?.breaches_details)
    ? record.ExposedBreaches.breaches_details
        .filter(Boolean)
        .map((entry) => ({
          breach: entry?.breach?.trim() || undefined,
          details: entry?.details || undefined,
          domain: entry?.domain || undefined,
          industry: entry?.industry || undefined,
          logo: entry?.logo || undefined,
          passwordRisk: entry?.password_risk || undefined,
          references: entry?.references || undefined,
          searchable: entry?.searchable || undefined,
          verified: entry?.verified || undefined,
          exposedData: entry?.xposed_data || entry?.exposed_data || undefined,
          exposedDate: entry?.xposed_date || undefined,
          exposedRecords: entry?.xposed_records ?? undefined,
          added: entry?.added || undefined,
        }))
    : [];
  return { breaches, details };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'User-Agent': 'VaultMail',
        },
      }
    );
    if (!response.ok) {
      return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
    }
    const data = await response.json();
    const { breaches, details } = normalizeResponse(data);
    return NextResponse.json({ breaches, details });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch breach data' }, { status: 500 });
  }
}
