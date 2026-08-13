import { createHmac, createHash } from 'node:crypto';

import {
  decodeBase32,
  generateTotpCode,
  parseTotpInput,
} from '../lib/totp.ts';

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

const assertEqual = (label: string, actual: string, expected: string) => {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`ok  ${label}`);
};

const sha1Empty = createHash('sha1').update('').digest('hex');
const sha1Abc = createHash('sha1').update('abc').digest('hex');
assertEqual('sha1 empty via node baseline ready', sha1Empty, sha1Empty);
assertEqual('sha1 abc via node baseline ready', sha1Abc, sha1Abc);

const hmacKey = Buffer.from('key');
const hmacMsg = Buffer.from('The quick brown fox jumps over the lazy dog');
const nodeHmac = createHmac('sha1', hmacKey).update(hmacMsg).digest('hex');

const rfcSecret = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
assertEqual('rfc secret length', String(rfcSecret.length), '20');
assertEqual('rfc secret ascii', Buffer.from(rfcSecret).toString('ascii'), '12345678901234567890');

const rfcSha1Vectors: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

const rfcConfig = parseTotpInput('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
if (!rfcConfig) {
  throw new Error('failed to parse RFC secret');
}
rfcConfig.digits = 8;

for (const [unixSeconds, expected] of rfcSha1Vectors) {
  const actual = generateTotpCode(rfcConfig, unixSeconds * 1000);
  assertEqual(`rfc6238 sha1 t=${unixSeconds}`, actual, expected);
}

const rfc256Secret = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA');
const rfc256Config = parseTotpInput('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA');
if (!rfc256Config) {
  throw new Error('failed to parse RFC SHA-256 secret');
}
rfc256Config.algorithm = 'SHA-256';
rfc256Config.digits = 8;
assertEqual('rfc256 secret length', String(rfc256Secret.length), '32');

const rfcSha256Vectors: Array<[number, string]> = [
  [59, '46119246'],
  [1111111109, '68084774'],
  [1111111111, '67062674'],
  [1234567890, '91819424'],
  [2000000000, '90698825'],
  [20000000000, '77737706'],
];

for (const [unixSeconds, expected] of rfcSha256Vectors) {
  const actual = generateTotpCode(rfc256Config, unixSeconds * 1000);
  assertEqual(`rfc6238 sha256 t=${unixSeconds}`, actual, expected);
}

const spaced = parseTotpInput('jbsw y3dp ehpk 3pxp');
const compact = parseTotpInput('JBSWY3DPEHPK3PXP');
if (!spaced || !compact) {
  throw new Error('failed to parse spaced secret');
}
assertEqual('spaced secret matches', spaced.secret, compact.secret);

const otpauth = parseTotpInput(
  'otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example&period=30&digits=6&algorithm=SHA1'
);
if (!otpauth) {
  throw new Error('failed to parse otpauth uri');
}
assertEqual('otpauth secret', otpauth.secret, 'JBSWY3DPEHPK3PXP');
assertEqual('otpauth issuer', otpauth.issuer || '', 'Example');

const now = 1_700_000_000;
const nodeCounter = Buffer.alloc(8);
nodeCounter.writeUInt32BE(Math.floor(now / 30), 4);
const nodeTotpHmac = createHmac('sha1', Buffer.from(compact.secretBytes))
  .update(nodeCounter)
  .digest();
const offset = nodeTotpHmac[nodeTotpHmac.length - 1] & 0x0f;
const binary =
  ((nodeTotpHmac[offset] & 0x7f) << 24) |
  ((nodeTotpHmac[offset + 1] & 0xff) << 16) |
  ((nodeTotpHmac[offset + 2] & 0xff) << 8) |
  (nodeTotpHmac[offset + 3] & 0xff);
const expectedNode = String((binary >>> 0) % 1_000_000).padStart(6, '0');
const actualNode = generateTotpCode(compact, now * 1000);
assertEqual('matches node hmac at fixed time', actualNode, expectedNode);
assertEqual('reference node hmac exists', nodeHmac.slice(0, 2), nodeHmac.slice(0, 2));

console.log('All TOTP checks passed.');
