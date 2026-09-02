export function parseLimit(value, fallback = 100, maximum = 100) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function isPositiveInteger(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

export function reportDatabaseError(res, message, error) {
  console.error(`${message}:`, error.message);
  return res.status(500).json({ error: message });
}
