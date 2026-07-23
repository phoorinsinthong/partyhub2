const LS_KEY = 'partyhub_ratelimit';

type RateBuckets = Record<string, number[]>;

function getBuckets(): RateBuckets {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') as RateBuckets; } catch { return {}; }
}

function saveBuckets(buckets: RateBuckets) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(buckets)); } catch { /* ignore */ }
}

export function rateLimit(key: string, maxActions: number, windowMs: number): boolean {
  const now = Date.now();
  const buckets = getBuckets();
  buckets[key] = (buckets[key] || []).filter((t: number) => now - t < windowMs);

  if (buckets[key].length >= maxActions) {
    saveBuckets(buckets);
    return false;
  }

  buckets[key].push(now);
  saveBuckets(buckets);
  return true;
}

export function rateLimitCreateRoom() {
  return rateLimit('createRoom', 3, 60000);
}

export function rateLimitJoinRoom() {
  return rateLimit('joinRoom', 10, 60000);
}
