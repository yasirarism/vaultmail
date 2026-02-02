import { NextResponse } from 'next/server';
import { inboxKey } from '@/lib/storage-keys';
import { storage } from '@/lib/storage';

type InboxEmail = {
  id?: string;
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  receivedAt?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    contentBase64?: string;
    omitted?: boolean;
    size?: number;
  }>;
};

const parseEmail = (value: unknown): InboxEmail | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as InboxEmail;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') {
    return value as InboxEmail;
  }
  return null;
};

const sanitizeFilename = (value: string, fallback: string) => {
  const safe = value
    .replace(/[^a-z0-9-_.]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return safe || fallback;
};

const htmlToText = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildEmailContent = (email: InboxEmail) => {
  const subject = email.subject || '(No Subject)';
  const textBody = email.text?.trim() || '';
  const htmlBody = email.html?.trim() || '';
  const useHtml = Boolean(htmlBody);
  const body = useHtml ? htmlBody : textBody || (htmlBody ? htmlToText(htmlBody) : '');
  const contentType = useHtml ? 'text/html' : 'text/plain';
  return [
    `From: ${email.from || ''}`,
    `To: ${email.to || ''}`,
    `Subject: ${subject}`,
    `Date: ${email.receivedAt ? new Date(email.receivedAt).toUTCString() : ''}`,
    'MIME-Version: 1.0',
    `Content-Type: ${contentType}; charset=utf-8`,
    '',
    body
  ].join('\n');
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const emailId = searchParams.get('emailId');
  const type = searchParams.get('type');
  const indexParam = searchParams.get('index');

  if (!address || !emailId || !type) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  const emails = await storage.lrange(inboxKey(address), 0, -1);
  const selected = (emails || [])
    .map((item) => parseEmail(item))
    .find((email) => email?.id === emailId);

  if (!selected) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  if (type === 'email') {
    const content = buildEmailContent(selected);
    const filename = sanitizeFilename(selected.subject || 'email', 'email');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'message/rfc822;charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}.eml"`
      }
    });
  }

  if (type === 'attachment') {
    const index = Number(indexParam);
    if (Number.isNaN(index)) {
      return NextResponse.json({ error: 'Invalid attachment index' }, { status: 400 });
    }
    const attachment = selected.attachments?.[index];
    if (attachment?.omitted) {
      return NextResponse.json(
        { error: 'Attachment too large to download' },
        { status: 413 }
      );
    }
    if (!attachment?.contentBase64) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }
    const filename = sanitizeFilename(attachment.filename || 'attachment', 'attachment');
    const buffer = Buffer.from(attachment.contentBase64, 'base64');
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': attachment.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  }

  return NextResponse.json({ error: 'Invalid download type' }, { status: 400 });
}
