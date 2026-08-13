const TIME_ENDPOINT = '/api/time';
const MIN_RESYNC_INTERVAL_MS = 60_000;

let offsetMs = 0;
let lastSyncAt = 0;
let syncPromise: Promise<number> | null = null;
let hasSynced = false;

const parseServerTime = async (response: Response, requestStart: number, requestEnd: number) => {
  let serverMs: number | null = null;

  try {
    const data = (await response.json()) as { unixMs?: number };
    if (typeof data?.unixMs === 'number' && Number.isFinite(data.unixMs)) {
      serverMs = data.unixMs;
    }
  } catch {
    serverMs = null;
  }

  if (serverMs == null) {
    const dateHeader = response.headers.get('date');
    if (dateHeader) {
      const parsed = Date.parse(dateHeader);
      if (!Number.isNaN(parsed)) {
        serverMs = parsed;
      }
    }
  }

  if (serverMs == null) {
    return offsetMs;
  }

  const roundTrip = Math.max(requestEnd - requestStart, 0);
  offsetMs = serverMs + roundTrip / 2 - requestEnd;
  lastSyncAt = requestEnd;
  hasSynced = true;
  return offsetMs;
};

export const getSyncedNow = () => Date.now() + offsetMs;

export const getClockOffsetMs = () => offsetMs;

export const hasServerTimeSync = () => hasSynced;

export const syncServerTime = async (force = false) => {
  const now = Date.now();
  if (!force && hasSynced && now - lastSyncAt < MIN_RESYNC_INTERVAL_MS) {
    return offsetMs;
  }
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    const requestStart = Date.now();
    try {
      const response = await fetch(TIME_ENDPOINT, {
        cache: 'no-store',
        headers: { pragma: 'no-cache' },
      });
      const requestEnd = Date.now();
      if (!response.ok) {
        return offsetMs;
      }
      return await parseServerTime(response, requestStart, requestEnd);
    } catch {
      return offsetMs;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
};
