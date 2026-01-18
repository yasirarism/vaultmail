import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  updatedAt: string;
};

const SETTINGS_KEY = 'settings:telegram';

const parseSettings = (value: unknown): TelegramSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TelegramSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as TelegramSettings;
  }
  return null;
};

const isAuthorized = (request: Request) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const provided = request.headers.get('x-admin-password');
  return Boolean(provided && provided === adminPassword);
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const settingsRaw = await redis.get(SETTINGS_KEY);
  const settings = parseSettings(settingsRaw) || {
    enabled: false,
    botToken: '',
    chatId: '',
    updatedAt: new Date().toISOString()
  };

  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const enabled = Boolean(body?.enabled);
  const botToken = String(body?.botToken || '').trim();
  const chatId = String(body?.chatId || '').trim();

  const settings: TelegramSettings = {
    enabled,
    botToken,
    chatId,
    updatedAt: new Date().toISOString()
  };

  await redis.set(SETTINGS_KEY, settings);

  return NextResponse.json(settings);
}
