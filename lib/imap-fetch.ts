import { createHash, randomUUID } from 'crypto';
import tls from 'tls';
import { storage } from '@/lib/storage';
import { IMAP_SETTINGS_KEY } from '@/lib/admin-auth';
import { lastUidKey } from '@/lib/storage-keys';
import { extractRfc822FromImapFetch, parseRfc822 } from '@/lib/email-mime';

export { lastUidKey };

type ImapConfig = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  rejectUnauthorized: boolean;
  maxFetch: number;
};

type ImapEmail = {
  id: string;
  sourceId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: unknown[];
  receivedAt: string;
  read: boolean;
};

const parseSettings = (value: unknown): ImapConfig | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as ImapConfig; } catch { return null; }
  }
  if (typeof value === 'object') return value as ImapConfig;
  return null;
};

const readConfig = async (): Promise<ImapConfig> => {
  const raw = await storage.get(IMAP_SETTINGS_KEY);
  const saved = parseSettings(raw);
  return {
    enabled: Boolean(saved?.enabled),
    host: saved?.host || '',
    port: Number(saved?.port || 993),
    user: saved?.user || '',
    password: saved?.password || '',
    tls: saved?.tls !== false,
    rejectUnauthorized: saved?.rejectUnauthorized !== false,
    maxFetch: Number(saved?.maxFetch || 30),
  };
};

const parseHeaders = (raw: string) => {
  const lines = raw.split(/\r?\n/);
  const map = new Map<string, string>();
  let current = '';
  for (const line of lines) {
    if (/^\s/.test(line) && current) {
      map.set(current, `${map.get(current) || ''} ${line.trim()}`.trim());
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    current = line.slice(0, idx).toLowerCase();
    map.set(current, line.slice(idx + 1).trim());
  }
  return map;
};

const decodeMimeEncodedWords = (value: string) =>
  value.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_m, charset, enc, text) => {
    try {
      const bytes = String(enc).toUpperCase() === 'B'
        ? Buffer.from(text, 'base64')
        : Buffer.from(text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_q: string, hex: string) => String.fromCharCode(parseInt(hex, 16))), 'binary');
      const normalizedCharset = String(charset || 'utf-8').toLowerCase();
      try {
        return new TextDecoder(normalizedCharset as BufferEncoding, { fatal: false }).decode(bytes);
      } catch {
        return bytes.toString('utf8');
      }
    } catch {
      return text;
    }
  });

const decodeQuotedPrintable = (value: string) => {
  const softBreakFixed = value.replace(/=\r?\n/g, '');
  const binary = softBreakFixed.replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return Buffer.from(binary, 'binary').toString('utf8');
};

const collectRecipientText = (headers: Map<string, string>) => {
  const values = [
    headers.get('to') || '',
    headers.get('cc') || '',
    headers.get('delivered-to') || '',
    headers.get('x-original-to') || '',
    headers.get('envelope-to') || ''
  ];
  return decodeMimeEncodedWords(values.join(' ')).toLowerCase();
};



const extractEmailAddresses = (text: string) => {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return [...new Set(matches.map((item) => item.toLowerCase()))];
};


const getHeaderFromRawResponse = (raw: string, header: string) => {
  const pattern = new RegExp(`(?:\r?\n|^)${header}:\s*([^\r\n]+)`, 'i');
  const match = raw.match(pattern);
  return match?.[1]?.trim() || '';
};

const parseReceivedAt = (rawDate?: string) => {
  if (!rawDate) return new Date().toISOString();
  const ts = Date.parse(rawDate);
  if (!Number.isFinite(ts)) return new Date().toISOString();
  return new Date(ts).toISOString();
};

const normalizeBodyText = (raw: string, transferEncoding?: string) => {
  const trimmed = raw.trim();
  const encoding = (transferEncoding || '').toLowerCase();
  if (encoding.includes('quoted-printable') || /=[0-9A-F]{2}/i.test(trimmed)) {
    return decodeQuotedPrintable(trimmed);
  }
  if (encoding.includes('base64')) {
    try {
      return Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch {
      return trimmed;
    }
  }
  return trimmed;
};

const stripInvisibleChars = (value: string) =>
  value.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').replace(/\u00A0/g, ' ');



const extractPartFromRawBody = (raw: string, contentType: 'text/plain' | 'text/html') => {
  const pattern = new RegExp(`Content-Type:\\s*${contentType.replace('/', '\\/')}[^\\r\\n]*(?:\\r?\\n[\\t ].*)*\\r?\\n(?:Content-Transfer-Encoding:\\s*([^\\r\\n;]+)[^\\r\\n]*\\r?\\n)?\\r?\\n([\\s\\S]*?)(?:\\r?\\n--[^\\r\\n]+|$)`, 'i');
  const htmlMatch = raw.match(pattern);
  if (!htmlMatch) return '';
  return normalizeBodyText((htmlMatch[2] || '').trim(), htmlMatch[1]);
};

const extractHtmlFromRawBody = (raw: string) => extractPartFromRawBody(raw, 'text/html');
const extractTextFromRawBody = (raw: string) => extractPartFromRawBody(raw, 'text/plain');

const extractPartByBoundary = (raw: string, contentType: 'text/plain' | 'text/html') => {
  const boundaryMatch = raw.match(/Content-Type:\s*multipart\/[^\r\n;]+(?:[^\r\n]*;\s*|\r?\n[\t ]*)boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch?.[1]) return '';
  const boundary = boundaryMatch[1].trim();
  const segments = raw.split(new RegExp(`(?:\r?\n)?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\r?\n`, 'g'));
  for (const segment of segments) {
    if (!new RegExp(`Content-Type:\\s*${contentType.replace('/', '\\/')}`, 'i').test(segment)) continue;
    const headerEnd = segment.search(/\r?\n\r?\n/);
    if (headerEnd === -1) continue;
    const headerText = segment.slice(0, headerEnd);
    const body = segment.slice(headerEnd).replace(/^\r?\n\r?\n/, '').trim();
    const transfer = headerText.match(/Content-Transfer-Encoding:\s*([^\r\n;]+)/i)?.[1];
    const normalized = normalizeBodyText(body, transfer);
    if (normalized) return normalized;
  }
  return '';
};

const extractHtmlFromAnyContent = (raw: string) => {
  const decoded = normalizeBodyText(raw, 'quoted-printable');
  const htmlDoc = decoded.match(/<html[\s\S]*<\/html>/i);
  if (htmlDoc) return htmlDoc[0];
  const bodyDoc = decoded.match(/<body[\s\S]*<\/body>/i);
  if (bodyDoc) return bodyDoc[0];
  const fragment = decoded.match(/<table[\s\S]*<\/table>/i);
  if (fragment?.[0]) return fragment[0];
  const genericHtml = decoded.match(/<(div|section|article|main|p|a|span|h1|h2|h3|h4|h5|h6|ul|ol|li)[\s\S]*<\/\1>/i);
  return genericHtml?.[0] || '';
};


const stripMailHeadersFromPreview = (text: string) => {
  const lines = text.split('\n');
  const filtered = lines.filter((line) => !/^(delivered-to|from|to|cc|subject|date|message-id):/i.test(line.trim()));
  return filtered.join('\n');
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildInboxPreview = (raw: string) => {
  const withoutTags = raw.replace(/<[^>]+>/g, ' ');
  const oneLine = stripInvisibleChars(withoutTags).replace(/\s+/g, ' ').trim();
  if (!oneLine) return '(No preview available)';
  return oneLine.length > 240 ? `${oneLine.slice(0, 237)}...` : oneLine;
};

const extractLiterals = (raw: Buffer) => {
  const out: string[] = [];
  const latin = raw.toString('latin1');
  const marker = /\{(\d+)\}\r\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(latin)) !== null) {
    const size = Number(match[1]);
    const start = marker.lastIndex;
    const end = start + size;
    if (Number.isFinite(size) && end <= raw.length) {
      out.push(raw.subarray(start, end).toString('utf8'));
      marker.lastIndex = end;
    }
  }
  return out;
};

const runImapCommand = (socket: tls.TLSSocket, tag: string, command: string) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (d: Buffer) => {
      chunks.push(d);
      const buf = Buffer.concat(chunks);
      const text = buf.toString('utf8');
      if (text.includes(`\r\n${tag} OK`) || text.endsWith(`${tag} OK\r\n`)) {
        cleanup();
        resolve(buf);
      } else if (text.includes(`\r\n${tag} NO`) || text.includes(`\r\n${tag} BAD`)) {
        cleanup();
        reject(new Error(`IMAP command failed: ${command}`));
      }
    };
    const onError = (e: Error) => { cleanup(); reject(e); };
    const cleanup = () => { socket.off('data', onData); socket.off('error', onError); };
    socket.on('data', onData);
    socket.on('error', onError);
    socket.write(`${tag} ${command}\r\n`);
  });

export const testImapConnection = async (config: {
  host: string; port: number; user: string; password: string; tls?: boolean; rejectUnauthorized?: boolean;
}) => {
  const cfg = {
    host: config.host.trim(),
    port: Number(config.port || 993),
    user: config.user.trim(),
    password: config.password,
    tls: config.tls !== false,
    rejectUnauthorized: config.rejectUnauthorized !== false
  };
  if (!cfg.host || !cfg.user || !cfg.password || !cfg.tls) throw new Error('IMAP config incomplete');

  const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized });
  await new Promise<void>((resolve, reject) => { socket.once('data', () => resolve()); socket.once('error', reject); });
  try {
    await runImapCommand(socket, 't1', `LOGIN "${cfg.user.replace(/"/g, '')}" "${cfg.password.replace(/"/g, '')}"`);
    await runImapCommand(socket, 't2', "SELECT INBOX");
    await runImapCommand(socket, 't9', 'LOGOUT');
    return { success: true };
  } finally { socket.end(); }
};

const IMAP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatImapDate = (timestampMs: number) => {
  const date = new Date(timestampMs);
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day}-${IMAP_MONTHS[date.getUTCMonth()]}-${date.getUTCFullYear()}`;
};

const formatGmailAfter = (timestampMs: number) => {
  const date = new Date(timestampMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}/${month}/${day}`;
};

const quoteImap = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const parseSearchUids = (raw: string) => {
  const line = raw.split('\n').find((item) => item.includes('* SEARCH')) || '';
  return line.replace(/.*\* SEARCH\s*/, '').trim().split(/\s+/).filter((item) => /^\d+$/.test(item));
};

const searchImapUids = async (
  socket: tls.TLSSocket,
  address: string,
  host: string,
  sinceMs: number,
  maxFetch: number
) => {
  const sinceDate = formatImapDate(sinceMs);
  const quoted = quoteImap(address);
  const commands: string[] = [];
  if (/gmail\.com/i.test(host)) {
    commands.push(`UID SEARCH X-GM-RAW ${quoteImap(`(to:${address} OR deliveredto:${address}) after:${formatGmailAfter(sinceMs)}`)}`);
  }
  commands.push(
    `UID SEARCH SINCE ${sinceDate} OR OR OR TO ${quoted} CC ${quoted} HEADER Delivered-To ${quoted} HEADER X-Original-To ${quoted}`,
    `UID SEARCH SINCE ${sinceDate} TO ${quoted}`,
    `UID SEARCH SINCE ${sinceDate}`
  );

  let uids: string[] = [];
  let usedFallback = false;
  for (const [index, command] of commands.entries()) {
    try {
      const response = await runImapCommand(socket, `s${index + 1}`, command);
      uids = parseSearchUids(response.toString('utf8'));
      usedFallback = command.endsWith(`SINCE ${sinceDate}`);
      if (uids.length > 0) break;
    } catch {
      // Try the next, broader search.
    }
  }

  const scanCap = usedFallback
    ? Math.min(Math.max(maxFetch * 20, 80), 400)
    : Math.min(Math.max(maxFetch * 8, 40), 250);
  return uids.slice(-scanCap);
};

export const fetchFromImap = async (
  address: string,
  existingSourceIds: Set<string>,
  options?: { sinceMs?: number }
) => {
  const debug = {
    totalUids: 0,
    recipientFiltered: 0,
    duplicateFiltered: 0,
    expiredFiltered: 0,
    returned: 0,
    search: ''
  };
  const cfg = await readConfig();
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.password || !cfg.tls) return { emails: [] as ImapEmail[], debug };

  const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized });
  await new Promise<void>((resolve, reject) => { socket.once('data', () => resolve()); socket.once('error', reject); });

  try {
    await runImapCommand(socket, 'a1', `LOGIN "${cfg.user.replace(/"/g, '')}" "${cfg.password.replace(/"/g, '')}"`);
    await runImapCommand(socket, 'a2', "SELECT INBOX");
    const sinceMs = options?.sinceMs && Number.isFinite(options.sinceMs)
      ? options.sinceMs
      : Date.now() - 86400 * 1000;
    const ids = await searchImapUids(socket, address, cfg.host, sinceMs, cfg.maxFetch);
    debug.totalUids = ids.length;
    debug.search = `since:${formatImapDate(sinceMs)}`;

    const out: ImapEmail[] = [];
    let maxSeenUid = 0;
    for (const uid of ids) {
      const uidNum = Number(uid);
      if (Number.isFinite(uidNum) && uidNum > maxSeenUid) maxSeenUid = uidNum;
      const resBuffer = await runImapCommand(
        socket,
        `f${uid}`,
        `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO CC DELIVERED-TO X-ORIGINAL-TO ENVELOPE-TO SUBJECT DATE MESSAGE-ID CONTENT-TRANSFER-ENCODING)] BODY.PEEK[])`
      );
      const res = resBuffer.toString('utf8');
      const literals = extractLiterals(resBuffer);
      const headers = parseHeaders(literals[0] || '');
      const rawFrom = headers.get('from') || getHeaderFromRawResponse(res, 'From') || 'Unknown Sender';
      const from = decodeMimeEncodedWords(rawFrom);
      const rawTo = headers.get('to') || headers.get('delivered-to') || getHeaderFromRawResponse(res, 'To') || '';
      const to = decodeMimeEncodedWords(rawTo);
      const recipientText = collectRecipientText(headers);
      const normalizedAddress = address.toLowerCase().trim();
      const recipientRaw = [
        headers.get('to') || '',
        headers.get('cc') || '',
        headers.get('delivered-to') || '',
        headers.get('x-original-to') || '',
        headers.get('envelope-to') || ''
      ].join(' ');
      const recipientAddresses = extractEmailAddresses(`${recipientRaw} ${recipientText}`);
      const fetchResponseText = res.toLowerCase();
      const matchesAddress = recipientAddresses.includes(normalizedAddress)
        || recipientText.includes(normalizedAddress)
        || fetchResponseText.includes(normalizedAddress);
      if (!matchesAddress) {
        debug.recipientFiltered += 1;
        continue;
      }

      const messageIdHeader = (headers.get('message-id') || '').trim();
      const messageIdentity = messageIdHeader || [
        headers.get('date') || '',
        headers.get('from') || '',
        headers.get('to') || headers.get('delivered-to') || '',
        headers.get('subject') || ''
      ].join('|');
      const sourceId = `imap:${createHash('sha1').update(messageIdentity).digest('hex')}`;
      if (existingSourceIds.has(sourceId)) {
        debug.duplicateFiltered += 1;
        continue;
      }
      const receivedAt = parseReceivedAt(headers.get('date'));
      if (new Date(receivedAt).getTime() < sinceMs) {
        debug.expiredFiltered += 1;
        continue;
      }

      const parsedMail = parseRfc822(extractRfc822FromImapFetch(resBuffer));
      const extractedText = parsedMail.text
        || extractTextFromRawBody(res)
        || extractPartByBoundary(res, 'text/plain');
      const extractedHtml = parsedMail.html
        || extractHtmlFromRawBody(res)
        || extractPartByBoundary(res, 'text/html')
        || extractHtmlFromAnyContent(res);
      const subject = decodeMimeEncodedWords(headers.get('subject') || getHeaderFromRawResponse(res, 'Subject') || '(No Subject)');
      const safeText = buildInboxPreview(extractedText || extractedHtml || subject);
      const safeHtml = extractedHtml || (extractedText ? `<pre style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;color:#222">${escapeHtml(extractedText)}</pre>` : `<p>${escapeHtml(safeText)}</p>`);
      out.push({
        id: randomUUID(),
        sourceId,
        from,
        to,
        subject,
        text: safeText,
        html: safeHtml,
        attachments: parsedMail.attachments,
        receivedAt,
        read: false
      });
    }
    if (maxSeenUid > 0) {
      await storage.set(lastUidKey(address), String(maxSeenUid));
    }
    await runImapCommand(socket, 'a9', 'LOGOUT');
    out.sort((left, right) => new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime());
    const emails = out.slice(0, cfg.maxFetch);
    debug.returned = emails.length;
    return { emails, debug };
  } finally { socket.end(); }
};
