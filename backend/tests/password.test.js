import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../utils/password.js";

test("password hashes verify and stay within USER.Password_hash length", async () => {
  const hash = await hashPassword("Owner#TestOnly26");
  assert.ok(hash.startsWith("scrypt$"));
  assert.ok(hash.length <= 255);
  assert.equal(await verifyPassword("Owner#TestOnly26", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});
