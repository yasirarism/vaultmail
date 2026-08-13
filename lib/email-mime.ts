export type ParsedAttachment = {
  filename?: string;
  contentType: string;
  size: number;
  contentBase64?: string;
  contentId?: string;
};

export type ParsedMail = {
  text: string;
  html: string;
  attachments: ParsedAttachment[];
};

type HeaderMap = Map<string, string>;

type MimeNode = {
  headers: HeaderMap;
  rawBody: Buffer;
  children: MimeNode[];
};

const MAX_INLINE_BYTES = 2_000_000;

const parseHeaderBlock = (raw: string): HeaderMap => {
  const map: HeaderMap = new Map();
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let current = '';
  for (const line of lines) {
    if (/^[ \t]/.test(line) && current) {
      map.set(current, `${map.get(current) || ''} ${line.trim()}`.trim());
      continue;
    }
    const index = line.indexOf(':');
    if (index === -1) continue;
    current = line.slice(0, index).toLowerCase();
    map.set(current, line.slice(index + 1).trim());
  }
  return map;
};

const headerParam = (value: string | undefined, name: string) => {
  if (!value) return '';
  const pattern = new RegExp(`${name}\\s*=\\s*"?([^";\\r\\n]+)"?`, 'i');
  return value.match(pattern)?.[1]?.trim() || '';
};

const decodeQuotedPrintable = (input: Buffer) => {
  const text = input.toString('latin1').replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '=' && /[0-9A-Fa-f]{2}/.test(text.slice(index + 1, index + 3))) {
      bytes.push(parseInt(text.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(text.charCodeAt(index) & 0xff);
    }
  }
  return Buffer.from(bytes);
};

const decodePartBody = (raw: Buffer, transferEncoding: string) => {
  const encoding = transferEncoding.toLowerCase();
  if (encoding.includes('base64')) {
    return Buffer.from(raw.toString('utf8').replace(/\s+/g, ''), 'base64');
  }
  if (encoding.includes('quoted-printable')) {
    return decodeQuotedPrintable(raw);
  }
  return raw;
};

const decodeText = (raw: Buffer, transferEncoding: string, charset: string) => {
  const decoded = decodePartBody(raw, transferEncoding);
  const normalized = (charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(normalized as BufferEncoding, { fatal: false }).decode(decoded);
  } catch {
    return decoded.toString('utf8');
  }
};

const splitMultipart = (body: Buffer, boundary: string): Buffer[] => {
  const latin = body.toString('latin1');
  const token = `--${boundary}`;
  const parts: Buffer[] = [];
  let cursor = latin.indexOf(token);
  if (cursor === -1) return parts;
  cursor += token.length;
  while (cursor < latin.length) {
    if (latin.startsWith('--', cursor)) break;
    if (latin.startsWith('\r\n', cursor)) cursor += 2;
    else if (latin.startsWith('\n', cursor)) cursor += 1;
    const next = latin.indexOf(`\r\n${token}`, cursor);
    const alt = latin.indexOf(`\n${token}`, cursor);
    const end = next === -1 ? alt : alt === -1 ? next : Math.min(next, alt);
    if (end === -1) break;
    parts.push(body.subarray(cursor, end));
    cursor = end + (latin[end] === '\r' ? 2 : 1) + token.length;
  }
  return parts;
};

const parseMimeNode = (raw: Buffer): MimeNode => {
  const latin = raw.toString('latin1');
  const split = latin.search(/\r?\n\r?\n/);
  const headerText = split === -1 ? latin : latin.slice(0, split);
  const bodyStart = split === -1 ? raw.length : split + (latin.slice(split).startsWith('\r\n\r\n') ? 4 : 2);
  const headers = parseHeaderBlock(headerText);
  const contentType = headers.get('content-type') || 'text/plain';
  const boundary = headerParam(contentType, 'boundary');
  const rawBody = raw.subarray(Math.min(bodyStart, raw.length));
  if (/^multipart\//i.test(contentType) && boundary) {
    return {
      headers,
      rawBody,
      children: splitMultipart(rawBody, boundary).map((part) => parseMimeNode(part)),
    };
  }
  return { headers, rawBody, children: [] };
};

const walk = (node: MimeNode, visit: (node: MimeNode) => void) => {
  visit(node);
  node.children.forEach((child) => walk(child, visit));
};

export const parseRfc822 = (raw: Buffer | string): ParsedMail => {
  const buffer = typeof raw === 'string' ? Buffer.from(raw, 'utf8') : raw;
  const root = parseMimeNode(buffer);
  let text = '';
  let html = '';
  const attachments: ParsedAttachment[] = [];

  walk(root, (node) => {
    if (node.children.length > 0) return;
    const contentType = node.headers.get('content-type') || 'text/plain';
    const transfer = node.headers.get('content-transfer-encoding') || '';
    const charset = headerParam(contentType, 'charset') || 'utf-8';
    const disposition = node.headers.get('content-disposition') || '';
    const filename =
      headerParam(disposition, 'filename') || headerParam(contentType, 'name') || undefined;
    const contentId = (node.headers.get('content-id') || '')
      .replace(/[<>]/g, '')
      .trim() || undefined;
    const mimeType = contentType.split(';')[0].trim().toLowerCase();
    const isAttachment = /attachment/i.test(disposition);
    const isInlineImage = /^image\//.test(mimeType) || Boolean(contentId);

    if (mimeType === 'text/html' && !html) {
      html = decodeText(node.rawBody, transfer, charset);
      return;
    }
    if (mimeType === 'text/plain' && !text) {
      text = decodeText(node.rawBody, transfer, charset);
      return;
    }
    if (isAttachment || isInlineImage) {
      const decoded = decodePartBody(node.rawBody, transfer);
      attachments.push({
        filename,
        contentType: mimeType || 'application/octet-stream',
        size: decoded.length,
        contentId,
        contentBase64: decoded.length > MAX_INLINE_BYTES ? undefined : decoded.toString('base64'),
      });
    }
  });

  return { text, html, attachments };
};

export const extractRfc822FromImapFetch = (raw: Buffer) => {
  const latin = raw.toString('latin1');
  const marker = /\{(\d+)\}\r\n/g;
  let best: { start: number; size: number } | null = null;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(latin)) !== null) {
    const size = Number(match[1]);
    const start = marker.lastIndex;
    if (Number.isFinite(size) && size > (best?.size || 0) && start + size <= raw.length) {
      best = { start, size };
    }
  }
  if (!best) return raw;
  return raw.subarray(best.start, best.start + best.size);
};
