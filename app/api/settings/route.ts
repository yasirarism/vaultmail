import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { extractEmail } from '@/lib/utils';

export async function POST(req: Request) {
  try {
    const { address, retentionSeconds, forwardTo } = await req.json();

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    if (retentionSeconds === undefined && forwardTo === undefined) {
      return NextResponse.json({ error: 'No settings to update' }, { status: 400 });
    }

    const normalizedAddress = extractEmail(address) ?? address.toLowerCase();
    const settingsKey = `settings:${normalizedAddress}`;
    const existingRaw = await redis.get(settingsKey);
    let existingSettings: Record<string, unknown> = {};

    if (existingRaw) {
      try {
        if (typeof existingRaw === 'string') {
          existingSettings = JSON.parse(existingRaw);
        } else if (typeof existingRaw === 'object') {
          existingSettings = existingRaw as Record<string, unknown>;
        }
      } catch (error) {
        console.error('Failed to parse settings', error);
      }
    }

    const updatedSettings: Record<string, unknown> = { ...existingSettings };

    if (retentionSeconds !== undefined) {
      const parsedRetention = parseInt(retentionSeconds, 10);
      if (Number.isNaN(parsedRetention)) {
        return NextResponse.json({ error: 'Invalid retention' }, { status: 400 });
      }
      updatedSettings.retentionSeconds = parsedRetention;
    }

    if (forwardTo !== undefined) {
      const trimmedForward = String(forwardTo).trim();
      if (!trimmedForward) {
        delete updatedSettings.forwardTo;
      } else {
        const normalizedForward = extractEmail(trimmedForward);
        if (!normalizedForward) {
          return NextResponse.json({ error: 'Invalid forward address' }, { status: 400 });
        }
        updatedSettings.forwardTo = normalizedForward;
      }
    }

    // Save settings for this address
    await redis.set(settingsKey, JSON.stringify(updatedSettings));

    // Also persist this setting itself for a few days so it doesn't vanish if unused
    // But typically it should last as long as the address is in use
    await redis.expire(settingsKey, 604800); // 7 days

    // If there are existing emails/keys, we might want to update their TTL, but that's expensive.
    // Instead, we focus on *future* emails respecting this. 
    // However, we SHOULD update the 'inbox:{address}' list TTL if it exists.
    const inboxKey = `inbox:${normalizedAddress}`;
    const exists = await redis.exists(inboxKey);
    if (exists && retentionSeconds !== undefined) {
        await redis.expire(inboxKey, parseInt(retentionSeconds, 10));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const normalizedAddress = extractEmail(address) ?? address.toLowerCase();
    const settingsRaw = await redis.get(`settings:${normalizedAddress}`);
    let settings: Record<string, unknown> = {};

    if (settingsRaw) {
      try {
        if (typeof settingsRaw === 'string') {
          settings = JSON.parse(settingsRaw);
        } else if (typeof settingsRaw === 'object') {
          settings = settingsRaw as Record<string, unknown>;
        }
      } catch (error) {
        console.error('Failed to parse settings', error);
      }
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
