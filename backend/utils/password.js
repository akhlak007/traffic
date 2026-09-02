import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const N = 16384;
const r = 8;
const p = 1;
const keyLength = 64;
const saltLength = 16;

export async function hashPassword(password) {
  const salt = randomBytes(saltLength);
  const key = await scrypt(password, salt, keyLength, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallel = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (!Number.isInteger(cost) || !salt.length || !expected.length) return false;
  const actual = await scrypt(password, salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallel,
    maxmem: 64 * 1024 * 1024
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
