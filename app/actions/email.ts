'use server';

import { getInboxEmails } from '@/lib/inbox-service';
import { storage } from '@/lib/storage';
import { inboxKey } from '@/lib/storage-keys';
import { getSessionFromRequest } from '@/lib/github-auth';

/**
 * Server-side data fetching — no browser fetch to raw API endpoints.
 */

// Helper: validate GitHub session or register guest session lazily
const getSession = async (): Promise<{ userId?: string; guestId?: string } | null> => {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const vmGuest = cookieStore.get('vm_guest')?.value;
  const vmSession = cookieStore.get('vm_session')?.value;

  if (vmSession) {
    const session = await (await import('@/lib/github-auth')).getSession(vmSession);
    if (session) return { userId: session.userId };
  }

  if (vmGuest) {
    // Lazy registration: if the cookie exists but hasn't been persisted yet,
    // register it now. This keeps the middleware edge-safe (no storage).
    const guest = await storage.get(`guest:${vmGuest}`);
    if (guest && typeof guest === 'object' && (guest as { valid: boolean }).valid) {
      return { guestId: vmGuest };
    }
    // First-time visit — register guest session
    await storage.set(`guest:${vmGuest}`, { valid: true, createdAt: new Date().toISOString() }, { ex: 60 * 60 * 24 * 7 });
    return { guestId: vmGuest };
  }

  return null;
};

export async function getInboxData(address: string, forceResync = false) {
  const session = await getSession();
  if (!session) {
    return { error: 'Unauthorized. Please login or enable guest session.' };
  }
  if (!address) return { error: 'Address required' };
  try {
    const result = await getInboxEmails(address, forceResync);
    return { emails: result.emails, imapDebug: result.imapDebug };
  } catch (error) {
    console.error('Inbox action error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { error: message, emails: [], checkedAt: new Date().toISOString() };
  }
}

export async function deleteInboxEmail(address: string, emailId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  if (!address || !emailId) return { error: 'Address and emailId required' };
  try {
    const deleted = await storage.ldeleteByIds(inboxKey(address), [emailId]);
    return { success: true, deleted };
  } catch (error) {
    console.error('Delete action error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getDomainsData() {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', domains: [] };
  try {
    const { DOMAINS_SETTINGS_KEY } = await import('@/lib/admin-auth');
    const raw = await storage.get(DOMAINS_SETTINGS_KEY);
    const domains = (raw && typeof raw === 'object' ? (raw as { domains?: string[] }).domains : null) || [];
    return { domains };
  } catch (error) {
    console.error('Domains action error:', error);
    return { error: 'Failed to load domains', domains: [] };
  }
}

export async function getDomainExpiration(domain: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', expiresAt: null };
  try {
    const raw = await storage.get(`domain:expiration:${domain}`);
    const expiresAt = raw && typeof raw === 'string' ? raw : null;
    return { expiresAt, checkedAt: new Date().toISOString() };
  } catch {
    return { expiresAt: null, checkedAt: new Date().toISOString() };
  }
}

export async function getRetentionSettings() {
  try {
    const { RETENTION_SETTINGS_KEY } = await import('@/lib/admin-auth');
    const raw = await storage.get(RETENTION_SETTINGS_KEY);
    const settings = (raw && typeof raw === 'object' ? raw : {}) as { seconds: number };
    return { seconds: settings.seconds || 86400 };
  } catch {
    return { seconds: 86400 };
  }
}

export async function getBrandingSettings() {
  try {
    const { BRANDING_SETTINGS_KEY } = await import('@/lib/admin-auth');
    const raw = await storage.get(BRANDING_SETTINGS_KEY);
    const settings = (raw && typeof raw === 'object' ? raw : {}) as Record<string, string>;
    return settings;
  } catch {
    return {};
  }
}

export async function downloadEmailContent(address: string, emailId: string) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  try {
    const emails = await storage.lrange(inboxKey(address), 0, -1);
    const email = (emails || []).find((e: unknown) => {
      const item = e as { id?: string };
      return item.id === emailId;
    });
    if (!email) return { error: 'Email not found' };
    const content = JSON.stringify(email, null, 2);
    const subject = (email as { subject?: string }).subject || 'email';
    const filename = subject.replace(/[^a-z0-9-_.]+/gi, '_').replace(/^_+|_+$/g, '') || 'email';
    return { content, filename: `${filename}.json`, type: 'application/json' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Download failed' };
  }
}

export async function downloadAttachmentContent(address: string, emailId: string, index: number) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized' };
  try {
    const emails = await storage.lrange(inboxKey(address), 0, -1);
    const email = (emails || []).find((e: unknown) => {
      const item = e as { id?: string };
      return item.id === emailId;
    });
    if (!email) return { error: 'Email not found' };
    const attachment = (email as { attachments?: Array<{ contentBase64?: string; filename?: string; contentType?: string }> }).attachments?.[index];
    if (!attachment?.contentBase64) return { error: 'Attachment not found' };
    const filename = attachment.filename?.replace(/[^a-z0-9-_.]+/gi, '_').replace(/^_+|_+$/g, '') || 'attachment';
    return {
      content: attachment.contentBase64,
      filename,
      type: attachment.contentType || 'application/octet-stream',
      isBase64: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Download failed' };
  }
}

export async function getBreachCheck(email: string) {
  try {
    const res = await fetch(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email)}`);
    if (!res.ok) return { error: 'Breach check failed' };
    const data = await res.json();
    return data;
  } catch {
    return { error: 'Breach check failed' };
  }
}