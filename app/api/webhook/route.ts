import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { extractEmail } from '@/lib/utils';
import { RETENTION_SETTINGS_KEY } from '@/lib/admin-auth';
import crypto from 'crypto';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
};

type RetentionSettings = {
  seconds: number;
};

const TELEGRAM_SETTINGS_KEY = 'settings:telegram';

const parseRetentionSettings = (value: unknown): RetentionSettings | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RetentionSettings;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as RetentionSettings;
  }
  return null;
};

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

const sendTelegramNotification = async (payload: {
  from: string;
  to: string;
  subject: string;
  text: string;
}) => {
  const settingsRaw = await redis.get(TELEGRAM_SETTINGS_KEY);
  const settings = parseSettings(settingsRaw);

  if (!settings?.enabled || !settings.botToken || !settings.chatId) {
    return;
  }

  const messageLines = [
    '📬 New Inbox Message',
    `From: ${payload.from}`,
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    '',
    payload.text
  ];

  const response = await fetch(
    `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: settings.chatId,
        text: messageLines.join('\n').slice(0, 4000),
        disable_web_page_preview: true
      })
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Telegram send failed:', response.status, errorBody);
  }
};

const getRetentionSeconds = async () => {
  const settingsRaw = await redis.get(RETENTION_SETTINGS_KEY);
  const settings = parseRetentionSettings(settingsRaw);
  return settings?.seconds || 86400;
};

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    let from, to, subject, text, html;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      ({ from, to, subject, text, html } = body);
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      from = formData.get('from') as string;
      to = formData.get('to') as string || formData.get('recipient') as string;
      subject = formData.get('subject') as string;
      text = formData.get('text') as string || formData.get('body-plain') as string;
      html = formData.get('html') as string || formData.get('body-html') as string;
    } else {
       return new NextResponse('Unsupported Content-Type', { status: 415 });
    }

    if (!to || !from) {
      return new NextResponse('Missing parameters', { status: 400 });
    }

    const cleanTo = extractEmail(to);
    
    if (!cleanTo) {
      return new NextResponse('Invalid recipient', { status: 400 });
    }

    const emailId = crypto.randomUUID();
    const emailData = {
      id: emailId,
      from,
      to,
      subject: subject || '(No Subject)',
      text: text || '',
      html: html || text || '', // Fallback
      receivedAt: new Date().toISOString(),
      read: false
    };

    const key = `inbox:${cleanTo}`;
    
    const retention = await getRetentionSeconds();
    
    // Store email in a list (LIFO usually better for email? No, Redis list is generic. lpush = prepend)
    // lpush puts new emails at index 0.
    await redis.lpush(key, emailData);
    
    // Set expiry based on global retention setting.
    await redis.expire(key, retention);

    await sendTelegramNotification({
      from,
      to,
      subject: subject || '(No Subject)',
      text: text || ''
    });

    return NextResponse.json({ success: true, id: emailId });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
