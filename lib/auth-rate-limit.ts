import { storage } from '@/lib/storage';

const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 60 * 5;

type RateLimitResult = {
  blocked: boolean;
  remainingSeconds?: number;
};

const parseCount = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
};

const lockoutKey = (prefix: string, ip: string) =>
  `${prefix}:lockout:${ip}`;

const attemptsKey = (prefix: string, ip: string) =>
  `${prefix}:attempts:${ip}`;

export const checkRateLimit = async (
  request: Request,
  prefix: string
): Promise<RateLimitResult> => {
  const ip = getClientIp(request);
  const locked = await storage.get(lockoutKey(prefix, ip));
  if (locked) {
    return { blocked: true };
  }
  return { blocked: false };
};

export const registerRateLimitFailure = async (
  request: Request,
  prefix: string
): Promise<RateLimitResult> => {
  const ip = getClientIp(request);
  const attempts = parseCount(await storage.get(attemptsKey(prefix, ip)));
  const nextAttempts = attempts + 1;
  await storage.set(attemptsKey(prefix, ip), nextAttempts, {
    ex: LOCKOUT_SECONDS
  });
  if (nextAttempts >= MAX_ATTEMPTS) {
    await storage.set(lockoutKey(prefix, ip), '1', { ex: LOCKOUT_SECONDS });
    await storage.del(attemptsKey(prefix, ip));
    return { blocked: true, remainingSeconds: LOCKOUT_SECONDS };
  }
  return { blocked: false };
};

export const resetRateLimit = async (request: Request, prefix: string) => {
  const ip = getClientIp(request);
  await Promise.all([
    storage.del(attemptsKey(prefix, ip)),
    storage.del(lockoutKey(prefix, ip))
  ]);
};
