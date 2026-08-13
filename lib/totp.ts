export const DEFAULT_TOTP_PERIOD = 30;
export const DEFAULT_TOTP_DIGITS = 6;

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export type TotpConfig = {
  secret: string;
  secretBytes: Uint8Array;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  issuer?: string;
  label?: string;
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotl = (value: number, bits: number) =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0;

const rotr = (value: number, bits: number) =>
  ((value >>> bits) | (value << (32 - bits))) >>> 0;

const clampInt = (value: string | null, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
};

export const normalizeBase32Secret = (value: string) =>
  value
    .toUpperCase()
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/8/g, 'B')
    .replace(/=+$/g, '')
    .replace(/[^A-Z2-7]/g, '');

export const decodeBase32 = (value: string): Uint8Array => {
  const cleaned = normalizeBase32Secret(value);
  let accumulator = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    accumulator = accumulator * 32 + index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      const shift = 2 ** bits;
      bytes.push(Math.floor(accumulator / shift) & 0xff);
      accumulator %= shift;
    }
  }

  return Uint8Array.from(bytes);
};

const normalizeAlgorithm = (value?: string | null): TotpAlgorithm => {
  const normalized = (value || 'SHA1').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized === 'SHA256' || normalized === 'SHA2') return 'SHA-256';
  if (normalized === 'SHA512') return 'SHA-512';
  return 'SHA-1';
};

const extractSecretParam = (value: string) => {
  const match = value.match(/(?:^|[?&])secret=([^&\s]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

export const parseTotpInput = (input: string): TotpConfig | null => {
  const raw = input.trim();
  if (!raw) return null;

  let secret = raw;
  let algorithm: TotpAlgorithm = 'SHA-1';
  let digits = DEFAULT_TOTP_DIGITS;
  let period = DEFAULT_TOTP_PERIOD;
  let issuer: string | undefined;
  let label: string | undefined;

  if (/^otpauth:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parsedSecret = url.searchParams.get('secret');
      if (!parsedSecret) return null;
      secret = parsedSecret;
      algorithm = normalizeAlgorithm(url.searchParams.get('algorithm'));
      digits = clampInt(url.searchParams.get('digits'), 6, 8, DEFAULT_TOTP_DIGITS);
      period = clampInt(url.searchParams.get('period'), 15, 180, DEFAULT_TOTP_PERIOD);
      issuer = url.searchParams.get('issuer') || undefined;
      const pathLabel = url.pathname.replace(/^\/+/, '');
      if (pathLabel) {
        try {
          label = decodeURIComponent(pathLabel);
        } catch {
          label = pathLabel;
        }
      }
    } catch {
      const fallbackSecret = extractSecretParam(raw);
      if (!fallbackSecret) return null;
      secret = fallbackSecret;
    }
  } else {
    const embeddedSecret = extractSecretParam(raw);
    if (embeddedSecret) {
      secret = embeddedSecret;
    }
  }

  const normalizedSecret = normalizeBase32Secret(secret);
  const secretBytes = decodeBase32(normalizedSecret);
  if (!normalizedSecret || !secretBytes.length) return null;

  return {
    secret: normalizedSecret,
    secretBytes,
    algorithm,
    digits,
    period,
    issuer,
    label,
  };
};

const packCounter = (counter: number): Uint8Array => {
  const bytes = new Uint8Array(8);
  let remaining = Math.max(Math.floor(counter), 0);
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return bytes;
};

const padMessage = (message: Uint8Array, blockSize: number) => {
  const bitLenHi = Math.floor(message.length / 0x20000000);
  const bitLenLo = (message.length << 3) >>> 0;
  const paddedLength = Math.ceil((message.length + 9) / blockSize) * blockSize;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, bitLenHi);
  view.setUint32(paddedLength - 4, bitLenLo);
  return { padded, view };
};

const sha1 = (message: Uint8Array): Uint8Array => {
  const { padded, view } = padMessage(message, 64);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotl(
        words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16],
        1
      );
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < 80; index += 1) {
      let f: number;
      let k: number;
      if (index < 20) {
        f = (b & c) ^ (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) ^ (b & d) ^ (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  const digest = new Uint8Array(20);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, h0);
  digestView.setUint32(4, h1);
  digestView.setUint32(8, h2);
  digestView.setUint32(12, h3);
  digestView.setUint32(16, h4);
  return digest;
};

const sha256 = (message: Uint8Array): Uint8Array => {
  const { padded, view } = padMessage(message, 64);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const source0 = rotr(words[index - 15], 7) ^ rotr(words[index - 15], 18) ^ (words[index - 15] >>> 3);
      const source1 = rotr(words[index - 2], 17) ^ rotr(words[index - 2], 19) ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + source0 + words[index - 7] + source1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + SHA256_K[index] + words[index]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, h0);
  digestView.setUint32(4, h1);
  digestView.setUint32(8, h2);
  digestView.setUint32(12, h3);
  digestView.setUint32(16, h4);
  digestView.setUint32(20, h5);
  digestView.setUint32(24, h6);
  digestView.setUint32(28, h7);
  return digest;
};

const hmac = (
  hash: (value: Uint8Array) => Uint8Array,
  blockSize: number,
  key: Uint8Array,
  message: Uint8Array
) => {
  const actualKey = key.length > blockSize ? hash(key) : key;
  const keyBlock = new Uint8Array(blockSize);
  keyBlock.set(actualKey);

  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let index = 0; index < blockSize; index += 1) {
    ipad[index] = keyBlock[index] ^ 0x36;
    opad[index] = keyBlock[index] ^ 0x5c;
  }

  const inner = new Uint8Array(blockSize + message.length);
  inner.set(ipad);
  inner.set(message, blockSize);

  const innerHash = hash(inner);
  const outer = new Uint8Array(blockSize + innerHash.length);
  outer.set(opad);
  outer.set(innerHash, blockSize);
  return hash(outer);
};

const digestForAlgorithm = (algorithm: TotpAlgorithm, key: Uint8Array, message: Uint8Array) => {
  if (algorithm === 'SHA-256') {
    return hmac(sha256, 64, key, message);
  }
  return hmac(sha1, 64, key, message);
};

const dynamicTruncate = (hmacBytes: Uint8Array, digits: number) => {
  const offset = hmacBytes[hmacBytes.length - 1] & 0x0f;
  const binary =
    (hmacBytes[offset] & 0x7f) * 0x1000000 +
    (hmacBytes[offset + 1] & 0xff) * 0x10000 +
    (hmacBytes[offset + 2] & 0xff) * 0x100 +
    (hmacBytes[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
};

export const getUnixSeconds = (timestampMs: number) => Math.floor(timestampMs / 1000);

export const getTotpCounter = (timestampMs: number, period = DEFAULT_TOTP_PERIOD) =>
  Math.floor(getUnixSeconds(timestampMs) / period);

export const getRemainingSeconds = (timestampMs: number, period = DEFAULT_TOTP_PERIOD) => {
  const elapsed = getUnixSeconds(timestampMs) % period;
  return elapsed === 0 ? period : period - elapsed;
};

export const generateTotpCode = (config: TotpConfig, timestampMs: number) => {
  if (config.algorithm === 'SHA-512') {
    throw new Error('SHA-512 TOTP requires Web Crypto');
  }
  const counter = getTotpCounter(timestampMs, config.period);
  const hmacBytes = digestForAlgorithm(config.algorithm, config.secretBytes, packCounter(counter));
  return dynamicTruncate(hmacBytes, config.digits);
};

export const generateTotpWindow = (config: TotpConfig, timestampMs: number) => {
  const stepMs = config.period * 1000;
  return {
    previous: generateTotpCode(config, timestampMs - stepMs),
    current: generateTotpCode(config, timestampMs),
    next: generateTotpCode(config, timestampMs + stepMs),
    remaining: getRemainingSeconds(timestampMs, config.period),
    counter: getTotpCounter(timestampMs, config.period),
  };
};

export const buildOtpAuthUrl = (config: TotpConfig, fallbackIssuer: string) => {
  const issuer = config.issuer || fallbackIssuer;
  const label = config.label || issuer;
  const params = new URLSearchParams({
    secret: config.secret,
    issuer,
    algorithm: config.algorithm.replace('-', ''),
    digits: String(config.digits),
    period: String(config.period),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
};

const copyBuffer = (bytes: Uint8Array) => {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
};

const hmacWithWebCrypto = async (
  algorithm: TotpAlgorithm,
  key: Uint8Array,
  message: Uint8Array
) => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    copyBuffer(key),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, copyBuffer(message));
  return new Uint8Array(signature);
};

export const generateTotpCodeAsync = async (config: TotpConfig, timestampMs: number) => {
  if (config.algorithm !== 'SHA-512') {
    return generateTotpCode(config, timestampMs);
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is unavailable');
  }
  const counter = getTotpCounter(timestampMs, config.period);
  const hmacBytes = await hmacWithWebCrypto(config.algorithm, config.secretBytes, packCounter(counter));
  return dynamicTruncate(hmacBytes, config.digits);
};

export const generateTotpWindowAsync = async (config: TotpConfig, timestampMs: number) => {
  if (config.algorithm !== 'SHA-512') {
    return generateTotpWindow(config, timestampMs);
  }
  const stepMs = config.period * 1000;
  const [previous, current, next] = await Promise.all([
    generateTotpCodeAsync(config, timestampMs - stepMs),
    generateTotpCodeAsync(config, timestampMs),
    generateTotpCodeAsync(config, timestampMs + stepMs),
  ]);
  return {
    previous,
    current,
    next,
    remaining: getRemainingSeconds(timestampMs, config.period),
    counter: getTotpCounter(timestampMs, config.period),
  };
};
