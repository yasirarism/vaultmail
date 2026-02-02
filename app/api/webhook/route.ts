import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { extractEmail, getSenderInfo } from '@/lib/utils';
import { RETENTION_SETTINGS_KEY, TELEGRAM_SETTINGS_KEY } from '@/lib/admin-auth';
import { inboxKey } from '@/lib/redis-keys';
import crypto from 'crypto';

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  allowedDomains?: string[];
};

type RetentionSettings = {
  seconds: number;
};

const DEFAULT_MAX_ATTACHMENT_BYTES = 2_000_000;
const MAX_ATTACHMENT_BYTES =
  Number(process.env.ATTACHMENT_MAX_BYTES) || DEFAULT_MAX_ATTACHMENT_BYTES;

const estimateBase64Bytes = (value?: string) => {
  if (!value) return 0;
  const normalized = value.trim().replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
};

const extractAttachmentsFromFormData = async (formData: FormData) => {
  const attachments = [];
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > MAX_ATTACHMENT_BYTES) {
        attachments.push({
          filename: value.name,
          contentType: value.type || 'application/octet-stream',
          size: value.size,
          omitted: true
        });
        continue;
      }
      const buffer = Buffer.from(await value.arrayBuffer());
      attachments.push({
        filename: value.name,
        contentType: value.type || 'application/octet-stream',
        size: value.size,
        contentBase64: buffer.toString('base64'),
        omitted: false
      });
    }
  }
  return attachments;
};

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

  if (Array.isArray(settings.allowedDomains)) {
    if (settings.allowedDomains.length === 0) {
      return;
    }
    const recipient = extractEmail(payload.to);
    const domain = recipient?.split('@').pop()?.toLowerCase();
    if (!domain || !settings.allowedDomains.includes(domain)) {
      return;
    }
  }

  const sender = getSenderInfo(payload.from);
  const messageLines = [
    '📬 New Inbox Message',
    `From: ${sender.label}`,
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
    
    let from, to, subject, text, html, attachments;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      ({ from, to, subject, text, html, attachments } = body);
      if (Array.isArray(attachments)) {
        attachments = attachments.map((attachment: Record<string, unknown>) => {
          const base64 = typeof attachment.contentBase64 === 'string' ? attachment.contentBase64 : '';
          const size =
            typeof attachment.size === 'number'
              ? attachment.size
              : estimateBase64Bytes(base64);
          if (size > MAX_ATTACHMENT_BYTES) {
            return {
              ...attachment,
              size,
              contentBase64: undefined,
              omitted: true
            };
          }
          return {
            ...attachment,
            size,
            omitted: false
          };
        });
      }
    } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      from = formData.get('from') as string;
      to = formData.get('to') as string || formData.get('recipient') as string;
      subject = formData.get('subject') as string;
      text = formData.get('text') as string || formData.get('body-plain') as string;
      html = formData.get('html') as string || formData.get('body-html') as string;
      attachments = await extractAttachmentsFromFormData(formData);
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
      attachments: Array.isArray(attachments) ? attachments : [],
      receivedAt: new Date().toISOString(),
      read: false
    };

    const key = inboxKey(cleanTo);
    
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
