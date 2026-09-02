import { randomBytes } from "node:crypto";

const SANDBOX_HOST = "sandbox.sslcommerz.com";
const LIVE_HOST = "securepay.sslcommerz.com";

export function sslcommerzConfig(environment = process.env) {
  const storeId = String(environment.SSLCOMMERZ_STORE_ID || "").trim();
  const storePassword = String(environment.SSLCOMMERZ_STORE_PASSWORD || "").trim();
  const isLive = String(environment.SSLCOMMERZ_IS_LIVE || "false").toLowerCase() === "true";
  const callbackBase = String(environment.SSLCOMMERZ_CALLBACK_BASE_URL || "").replace(/\/+$/, "");
  const configured = Boolean(storeId && storePassword && /^https:\/\//i.test(callbackBase));
  return {
    storeId,
    storePassword,
    isLive,
    callbackBase,
    configured,
    initiateUrl: isLive
      ? `https://${LIVE_HOST}/gwprocess/v4/api.php`
      : `https://${SANDBOX_HOST}/gwprocess/v4/api.php`,
    validateUrl: isLive
      ? `https://${LIVE_HOST}/validator/api/validationserverAPI.php`
      : `https://${SANDBOX_HOST}/validator/api/validationserverAPI.php`
  };
}

export function callbackUrls(callbackBase) {
  const base = String(callbackBase || "").replace(/\/+$/, "");
  return {
    success: `${base}/api/payments/ssl/success`,
    fail: `${base}/api/payments/ssl/fail`,
    cancel: `${base}/api/payments/ssl/cancel`,
    ipn: `${base}/api/payments/ssl/ipn`
  };
}

export function createTranId() {
  return `ST${Date.now().toString(36)}${randomBytes(4).toString("hex")}`.slice(0, 30);
}

export function amountsMatch(expected, actual) {
  const left = Number(expected);
  const right = Number(actual);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) < 0.005;
}

export function isSuccessfulValidationStatus(status) {
  const value = String(status || "").toUpperCase();
  return value === "VALID" || value === "VALIDATED";
}

export function isSafeGatewayPageUrl(url, isLive = false) {
  try {
    const parsed = new URL(String(url || ""));
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === (isLive ? LIVE_HOST : SANDBOX_HOST);
  } catch {
    return false;
  }
}

export function frontendNoticesUrl(environment = process.env, outcome = "") {
  const origin = String(environment.CORS_ORIGINS || "http://127.0.0.1:4173")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
  const suffix = outcome ? `?ssl=${encodeURIComponent(outcome)}` : "";
  return `${origin}/pages/owner-notices.html${suffix}`;
}

export function gatewayFields(req) {
  return { ...(req.query || {}), ...(req.body || {}) };
}
