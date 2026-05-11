import { createHash, randomUUID } from 'crypto';
import tls from 'tls';
import { storage } from '@/lib/storage';
import { IMAP_SETTINGS_KEY } from '@/lib/admin-auth';

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

const lastUidKey = (address: string) => `imap:lastuid:${address.toLowerCase()}`;

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
  value.replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_m, _charset, enc, text) => {
    try {
      if (String(enc).toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8');
      const qp = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_q: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      return Buffer.from(qp, 'binary').toString('utf8');
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
  return decodeMimeEncodedWords(values.join(' ').toLowerCase());
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


const extractLiterals = (raw: string) => {
  const out: string[] = [];
  const marker = /\{(\d+)\}\r\n/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(raw)) !== null) {
    const size = Number(match[1]);
    const start = marker.lastIndex;
    const end = start + size;
    if (Number.isFinite(size) && end <= raw.length) {
      out.push(raw.slice(start, end));
      marker.lastIndex = end;
    }
  }
  return out;
};

const runImapCommand = (socket: tls.TLSSocket, tag: string, command: string) =>
  new Promise<string>((resolve, reject) => {
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString('utf8');
      if (buf.includes(`\r\n${tag} OK`) || buf.endsWith(`${tag} OK\r\n`)) {
        cleanup();
        resolve(buf);
      } else if (buf.includes(`\r\n${tag} NO`) || buf.includes(`\r\n${tag} BAD`)) {
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

export const fetchFromImap = async (address: string, existingSourceIds: Set<string>) => {
  const cfg = await readConfig();
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.password || !cfg.tls) return [] as ImapEmail[];

  const domain = address.split('@')[1]?.toLowerCase();
  const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized });
  await new Promise<void>((resolve, reject) => { socket.once('data', () => resolve()); socket.once('error', reject); });

  try {
    await runImapCommand(socket, 'a1', `LOGIN "${cfg.user.replace(/"/g, '')}" "${cfg.password.replace(/"/g, '')}"`);
    await runImapCommand(socket, 'a2', "SELECT INBOX");
    const lastUidRaw = await storage.get(lastUidKey(address));
    const lastUid = Number(lastUidRaw || 0);
    const search = await runImapCommand(
      socket,
      'a3',
      lastUid > 0 ? `UID SEARCH UID ${lastUid + 1}:*` : 'UID SEARCH ALL'
    );
    const idsLine = search.split('\n').find((l) => l.includes('* SEARCH')) || '';
    const ids = idsLine.replace(/.*\* SEARCH\s*/, '').trim().split(/\s+/).filter(Boolean).slice(-cfg.maxFetch);

    const out: ImapEmail[] = [];
    let maxSeenUid = lastUid;
    for (const uid of ids) {
      const uidNum = Number(uid);
      const res = await runImapCommand(
        socket,
        `f${uid}`,
        `UID FETCH ${uid} (BODY.PEEK[HEADER.FIELDS (FROM TO CC DELIVERED-TO X-ORIGINAL-TO ENVELOPE-TO SUBJECT DATE MESSAGE-ID CONTENT-TRANSFER-ENCODING)] BODY.PEEK[TEXT]<0.50000>)`
      );
      const literals = extractLiterals(res);
      const headers = parseHeaders(literals[0] || '');
      const to = decodeMimeEncodedWords(headers.get('to') || headers.get('delivered-to') || '');
      const recipientText = collectRecipientText(headers);
      const matchesExact = recipientText.includes(address.toLowerCase());
      const matchesDomain = domain ? recipientText.includes(`@${domain}`) : false;
      if (!matchesExact && !matchesDomain) continue;

      const messageId = headers.get('message-id') || `${uid}:${headers.get('date') || ''}:${headers.get('subject') || ''}`;
      const sourceId = `imap:${createHash('sha1').update(messageId).digest('hex')}`;
      if (existingSourceIds.has(sourceId)) continue;

      const transferEncoding = headers.get('content-transfer-encoding') || '';
      const rawBody = literals[1] || literals[0] || '';
      const normalizedText = normalizeBodyText(rawBody, transferEncoding);
      const safeText = normalizedText || decodeMimeEncodedWords(headers.get('subject') || '') || '(No preview available)';
      out.push({
        id: randomUUID(),
        sourceId,
        from: decodeMimeEncodedWords(headers.get('from') || 'Unknown Sender'),
        to,
        subject: decodeMimeEncodedWords(headers.get('subject') || '(No Subject)'),
        text: safeText,
        html: safeText,
        attachments: [],
        receivedAt: headers.get('date') ? new Date(headers.get('date')!).toISOString() : new Date().toISOString(),
        read: false
      });
      if (Number.isFinite(uidNum) && uidNum > maxSeenUid) maxSeenUid = uidNum;
    }
    if (maxSeenUid > lastUid) {
      await storage.set(lastUidKey(address), String(maxSeenUid));
    }
    await runImapCommand(socket, 'a9', 'LOGOUT');
    return out;
  } finally { socket.end(); }
};
