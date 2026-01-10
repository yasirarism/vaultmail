import { redis } from '@/lib/redis';
import { NextResponse } from 'next/server';
import { extractEmail } from '@/lib/utils';
import crypto from 'crypto';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

async function forwardEmail({
  to,
  from,
  subject,
  text,
  html
}: {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const forwardFrom = process.env.FORWARD_FROM_EMAIL;

  if (!apiKey || !forwardFrom) {
    console.warn('Forwarding skipped: missing RESEND_API_KEY or FORWARD_FROM_EMAIL');
    return;
  }

  const payload = {
    from: forwardFrom,
    to: [to],
    subject,
    text,
    html,
    headers: {
      'X-Forwarded-From': from
    }
  };

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Forwarding failed', response.status, errorText);
    }
  } catch (error) {
    console.error('Forwarding error', error);
  }
}

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
    
    // Check for custom retention settings
    const settingsKey = `settings:${cleanTo}`;
    const settingsRaw = await redis.get(settingsKey);
    let retention = 86400; // Default 24h
    let forwardTo: string | null = null;

    if (settingsRaw) {
        try {
            // If stored as JSON string
            if (typeof settingsRaw === 'string') {
                 const s = JSON.parse(settingsRaw);
                 if (s.retentionSeconds) retention = s.retentionSeconds;
                 if (s.forwardTo) forwardTo = s.forwardTo;
            } else if (typeof settingsRaw === 'object') {
                 // Upstash REST client might return object directly if auto-deserializing
                 const s = settingsRaw as any;
                 if (s.retentionSeconds) retention = s.retentionSeconds;
                 if (s.forwardTo) forwardTo = s.forwardTo;
            }
        } catch (e) {
            console.error("Failed to parse settings", e);
        }
    }
    
    // Store email in a list (LIFO usually better for email? No, Redis list is generic. lpush = prepend)
    // lpush puts new emails at index 0.
    await redis.lpush(key, emailData);
    
    // Set expiry based on retention setting
    // Note: expire only works on the key, so it refreshes the whole list TTL.
    await redis.expire(key, retention);

    if (forwardTo) {
      await forwardEmail({
        to: forwardTo,
        from,
        subject: subject || '(No Subject)',
        text: text || '',
        html: html || text || ''
      });
    }

    return NextResponse.json({ success: true, id: emailId });
  } catch (error) {
    console.error('Webhook Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
