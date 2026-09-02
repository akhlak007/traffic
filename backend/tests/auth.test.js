import test from "node:test";
import assert from "node:assert/strict";
import { configuredPrincipals, resolvePrincipal, signSession, validateAuthConfiguration, verifySession } from "../middleware/auth.js";

const environment = {
  ADMIN_API_TOKEN: "admin-secret-value-000000000000000",
  OFFICER_API_TOKEN: "officer-secret-value-0000000000000",
  SUPERVISOR_API_TOKEN: "supervisor-secret-value-0000000000",
  OWNER_API_TOKEN: "owner-secret-value-000000000000000",
  DMP_API_TOKEN: "dmp-secret-value-00000000000000000",
  OWNER_USER_ID: "42",
  AUTH_SECRET: "auth-secret-value-00000000000000000"
};

test("role tokens resolve to scoped principals", () => {
  const owner = resolvePrincipal(environment.OWNER_API_TOKEN, environment);
  assert.equal(owner.role, "owner");
  assert.equal(owner.ownerId, 42);
  assert.equal(resolvePrincipal("wrong", environment), null);
  assert.equal(configuredPrincipals(environment).length, 5);
});

test("signed session tokens resolve without exposing static role tokens", () => {
  const token = signSession({ role: "owner", userId: 17, ownerId: 17 }, environment.AUTH_SECRET);
  const session = verifySession(token, environment.AUTH_SECRET);
  assert.equal(session.role, "owner");
  assert.equal(session.userId, 17);
  assert.equal(session.ownerId, 17);
  const resolved = resolvePrincipal(token, environment);
  assert.equal(resolved.role, "owner");
  assert.equal(resolved.userId, 17);
  assert.equal(resolvePrincipal("sess.tampered.signature", environment), null);
});

test("configuration validation fails closed", () => {
  assert.throws(() => validateAuthConfiguration({}), /Missing API authentication settings/);
  assert.throws(
    () => validateAuthConfiguration({ ...environment, OWNER_API_TOKEN: "short" }),
    /at least 32 bytes/
  );
  assert.throws(
    () => validateAuthConfiguration({ ...environment, OWNER_API_TOKEN: environment.ADMIN_API_TOKEN }),
    /must be unique/
  );
  assert.throws(
    () => validateAuthConfiguration({ ...environment, AUTH_SECRET: "short" }),
    /AUTH_SECRET/
  );
  assert.doesNotThrow(() => validateAuthConfiguration(environment));
});

test("owner login and registration use USER.Password_hash, not OWNER_CREDENTIAL", async () => {
  const { readFile } = await import("node:fs/promises");
  const auth = await readFile(new URL("../controllers/authController.js", import.meta.url), "utf8");
  const middleware = await readFile(new URL("../middleware/auth.js", import.meta.url), "utf8");
  const seed = await readFile(new URL("../scripts/seed-faculty-demo.mjs", import.meta.url), "utf8");
  const ddl = await readFile(new URL("../../database/01_create_tables.sql", import.meta.url), "utf8");
  assert.doesNotMatch(auth, /OWNER_CREDENTIAL/);
  assert.doesNotMatch(seed, /OWNER_CREDENTIAL/);
  assert.doesNotMatch(ddl, /CREATE TABLE OWNER_CREDENTIAL/);
  assert.doesNotMatch(auth, /configuredDemoLogins/);
  assert.doesNotMatch(middleware, /DEMO_ADMIN_USERNAME/);
  assert.doesNotMatch(middleware, /configuredDemoLogins/);
  assert.match(ddl, /Password_hash VARCHAR2\(255\)/);
  assert.match(auth, /u\.Password_hash AS "passwordHash"/);
  assert.match(auth, /LEFT JOIN ADMIN a ON a\.ID = u\.ID/);
  assert.match(auth, /LEFT JOIN TRAFFIC_OFFICER t ON t\.ID = u\.ID/);
  assert.match(auth, /INSERT INTO "USER" \(First_name, Last_name, Email, Password_hash\)/);
  assert.match(auth, /INSERT INTO VEHICLE_OWNER \(ID, Address\)/);
  assert.match(seed, /mushfiq\.admin@traffic\.demo/);
  assert.match(seed, /indira\.officer@traffic\.demo/);
});

test("display names join first and last name without exposing hashes", async () => {
  const { formatUserName } = await import("../utils/userName.js");
  assert.equal(formatUserName({ firstName: "Akhlak", lastName: "Ud Zaman" }), "Akhlak Ud Zaman");
  assert.equal(formatUserName({ firstName: "Nadia", lastName: "  " }), "Nadia");
  assert.equal(formatUserName({}), null);
  const { readFile } = await import("node:fs/promises");
  const names = await readFile(new URL("../utils/userName.js", import.meta.url), "utf8");
  assert.doesNotMatch(names, /Password_hash/i);
});

