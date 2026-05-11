import { createHash, randomUUID } from 'crypto';
import tls from 'tls';

type ImapConfig = {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  mailbox: string;
  tls: boolean;
  maxFetch: number;
  domainFilter?: string;
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

const readConfig = (): ImapConfig => ({
  enabled: process.env.IMAP_FETCH_ENABLED === 'true',
  host: process.env.IMAP_HOST || '',
  port: Number(process.env.IMAP_PORT || 993),
  user: process.env.IMAP_USER || '',
  password: process.env.IMAP_PASSWORD || '',
  mailbox: process.env.IMAP_MAILBOX || 'INBOX',
  tls: process.env.IMAP_TLS !== 'false',
  maxFetch: Number(process.env.IMAP_MAX_FETCH || 30),
  domainFilter: (process.env.IMAP_DOMAIN_FILTER || '').toLowerCase() || undefined
});

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

export const fetchFromImap = async (address: string, existingSourceIds: Set<string>) => {
  const cfg = readConfig();
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.password) return [] as ImapEmail[];

  const domain = address.split('@')[1]?.toLowerCase();
  if (cfg.domainFilter && cfg.domainFilter !== domain) return [] as ImapEmail[];

  if (!cfg.tls) return [] as ImapEmail[];
  const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false' });
  await new Promise<void>((resolve, reject) => {
    socket.once('data', () => resolve());
    socket.once('error', reject);
  });

  try {
    await runImapCommand(socket, 'a1', `LOGIN \"${cfg.user.replace(/\"/g, '')}\" \"${cfg.password.replace(/\"/g, '')}\"`);
    await runImapCommand(socket, 'a2', `SELECT ${cfg.mailbox}`);
    const search = await runImapCommand(socket, 'a3', 'SEARCH ALL');
    const idsLine = search.split('\n').find((l) => l.includes('* SEARCH')) || '';
    const ids = idsLine.replace(/.*\* SEARCH\s*/, '').trim().split(/\s+/).filter(Boolean);
    const take = ids.slice(-cfg.maxFetch);

    const out: ImapEmail[] = [];
    for (const id of take) {
      const res = await runImapCommand(socket, `f${id}`, `FETCH ${id} (BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)] BODY.PEEK[TEXT]<0.20000>)`);
      const literals = [...res.matchAll(/\{(\d+)\}\r\n([\s\S]*?)(?=\r\n(?:\)|f\d+ ))/g)].map((m) => m[2]);
      const headerRaw = literals[0] || '';
      const textRaw = literals[1] || '';
      const headers = parseHeaders(headerRaw);
      const to = headers.get('to') || '';
      if (!to.toLowerCase().includes(address.toLowerCase()) && !to.toLowerCase().includes(`@${domain}`)) continue;
      const messageId = headers.get('message-id') || `${id}:${headers.get('date') || ''}:${headers.get('subject') || ''}`;
      const sourceId = `imap:${createHash('sha1').update(messageId).digest('hex')}`;
      if (existingSourceIds.has(sourceId)) continue;
      out.push({
        id: randomUUID(),
        sourceId,
        from: headers.get('from') || 'Unknown Sender',
        to,
        subject: headers.get('subject') || '(No Subject)',
        text: textRaw.trim(),
        html: textRaw.trim(),
        attachments: [],
        receivedAt: headers.get('date') ? new Date(headers.get('date')!).toISOString() : new Date().toISOString(),
        read: false
      });
    }

    await runImapCommand(socket, 'a9', 'LOGOUT');
    return out;
  } finally {
    socket.end();
  }
};
