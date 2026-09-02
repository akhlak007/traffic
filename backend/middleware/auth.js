import { createHmac, timingSafeEqual } from "node:crypto";

const ROLE_TOKEN_ENV = Object.freeze({
  admin: "ADMIN_API_TOKEN",
  officer: "OFFICER_API_TOKEN",
  supervisor: "SUPERVISOR_API_TOKEN",
  owner: "OWNER_API_TOKEN",
  dmp: "DMP_API_TOKEN"
});

const SESSION_PREFIX = "sess.";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function safelyEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function configuredPrincipals(environment = process.env) {
  const userIds = {
    admin: Number(environment.ADMIN_USER_ID || 1),
    officer: Number(environment.TRAFFIC_OFFICER_USER_ID || 7),
    supervisor: Number(environment.SUPERVISOR_USER_ID || 6),
    owner: Number(environment.OWNER_USER_ID || 17),
    dmp: Number(environment.DMP_OFFICER_USER_ID || 12)
  };
  return Object.entries(ROLE_TOKEN_ENV)
    .map(([role, envName]) => ({
      role,
      token: environment[envName],
      userId: userIds[role],
      ownerId: role === "owner" ? userIds.owner : null
    }))
    .filter((principal) => principal.token);
}

export function validateAuthConfiguration(environment = process.env) {
  const missing = Object.values(ROLE_TOKEN_ENV).filter((name) => !environment[name]);
  if (missing.length) {
    throw new Error(`Missing API authentication settings: ${missing.join(", ")}`);
  }

  const tokens = Object.values(ROLE_TOKEN_ENV).map((name) => environment[name]);
  const weak = Object.entries(ROLE_TOKEN_ENV)
    .filter(([, envName]) => Buffer.byteLength(environment[envName], "utf8") < 32)
    .map(([role]) => role);
  if (weak.length) {
    throw new Error(`API tokens must be at least 32 bytes: ${weak.join(", ")}`);
  }
  if (new Set(tokens).size !== tokens.length) {
    throw new Error("API role tokens must be unique");
  }

  if (environment.AUTH_SECRET !== undefined && Buffer.byteLength(environment.AUTH_SECRET, "utf8") < 32) {
    throw new Error("AUTH_SECRET must be at least 32 bytes");
  }
}

export function signSession(principal, secret, ttlMs = SESSION_TTL_MS) {
  const payload = Buffer.from(JSON.stringify({
    role: principal.role,
    userId: principal.userId,
    ownerId: principal.ownerId,
    exp: Date.now() + ttlMs
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${SESSION_PREFIX}${payload}.${signature}`;
}

export function verifySession(token, secret) {
  if (!token?.startsWith(SESSION_PREFIX) || !secret) return null;
  const raw = token.slice(SESSION_PREFIX.length);
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data?.exp || data.exp < Date.now()) return null;
  if (!ROLE_TOKEN_ENV[data.role]) return null;
  return {
    role: data.role,
    userId: Number(data.userId),
    ownerId: data.role === "owner" ? Number(data.ownerId) : null
  };
}

export function resolvePrincipal(token, environment = process.env) {
  if (!token) return null;
  const staticPrincipal = configuredPrincipals(environment).find((principal) => safelyEqual(token, principal.token));
  if (staticPrincipal) return staticPrincipal;
  return verifySession(token, environment.AUTH_SECRET);
}

export function authenticationMiddleware(environment = process.env) {
  return (req, res, next) => {
    const header = req.get("authorization") || "";
    const match = /^Bearer\s+(.+)$/i.exec(header);
    const principal = resolvePrincipal(match?.[1], environment);
    if (!principal) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = principal;
    next();
  };
}

export const authenticate = authenticationMiddleware();

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}
