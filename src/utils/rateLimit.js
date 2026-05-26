const LS_KEY = 'partyhub_ratelimit';

function getBuckets() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}

function saveBuckets(buckets) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(buckets)); } catch {}
}

export function rateLimit(key, maxActions, windowMs) {
  const now = Date.now();
  const buckets = getBuckets();
  buckets[key] = (buckets[key] || []).filter((t) => now - t < windowMs);

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
