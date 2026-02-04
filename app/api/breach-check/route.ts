import { NextResponse } from 'next/server';

const normalizeBreaches = (data: unknown) => {
  const record = data as {
    breaches?: unknown;
    Breaches?: unknown;
    data?: { breaches?: unknown };
  };
  const raw =
    (Array.isArray(record?.breaches) && record.breaches) ||
    (Array.isArray(record?.Breaches) && record.Breaches) ||
    (Array.isArray(record?.data?.breaches) && record.data.breaches) ||
    [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const entry = item as {
          Name?: string;
          name?: string;
          breach?: string;
          Breach?: string;
          title?: string;
          site?: string;
          domain?: string;
        };
        return (
          entry.Name ||
          entry.name ||
          entry.breach ||
          entry.Breach ||
          entry.title ||
          entry.site ||
          entry.domain ||
          ''
        );
      }
      return '';
    })
    .filter((value) => value);
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'Missing email' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(email)}`,
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
    const breaches = normalizeBreaches(data);
    return NextResponse.json({ breaches });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch breach data' }, { status: 500 });
  }
}
