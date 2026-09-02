const requestBuckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 120 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = requestBuckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    requestBuckets.set(key, bucket);
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.set("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      return res.status(429).json({ error: "Too many requests" });
    }
    next();
  };
}

export function resetRateLimits() {
  requestBuckets.clear();
}
