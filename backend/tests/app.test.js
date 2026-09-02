import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { signSession } from "../middleware/auth.js";

const environment = {
  CORS_ORIGINS: "http://127.0.0.1:4173",
  RATE_LIMIT_PER_MINUTE: "1000",
  ADMIN_API_TOKEN: "admin-secret-value",
  OWNER_API_TOKEN: "owner-secret-value"
};

async function withServer(callback) {
  const server = createApp(environment).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("API rejects missing and invalid bearer tokens", async () => {
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/not-a-route`);
    assert.equal(missing.status, 401);
    const invalid = await fetch(`${baseUrl}/api/not-a-route`, { headers: { Authorization: "Bearer wrong" } });
    assert.equal(invalid.status, 401);
  });
});

test("authenticated requests receive security headers and a JSON 404", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/not-a-route`, {
      headers: { Authorization: "Bearer admin-secret-value", Origin: "http://127.0.0.1:4173" }
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:4173");
    assert.deepEqual(await response.json(), { error: "Route not found" });
  });
});

test("role middleware denies owner access to the database viewer", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/database/tables`, {
      headers: { Authorization: "Bearer owner-secret-value" }
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Insufficient permissions" });
  });
});

test("combined deployment serves the frontend without API authentication", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Traffic AI Dhaka \| Sign in/);
  });
});

test("owner registration is public and rejects incomplete details", async () => {
  await withServer(async (baseUrl) => {
    const incomplete = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A" })
    });
    assert.equal(incomplete.status, 400);
  });
});

test("login is public and rejects missing credentials", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert.equal(response.status, 400);
  });
});

const loginEnvironment = {
  CORS_ORIGINS: "http://127.0.0.1:4173",
  RATE_LIMIT_PER_MINUTE: "1000",
  ADMIN_API_TOKEN: "admin-secret-value-000000000000000",
  OFFICER_API_TOKEN: "officer-secret-value-0000000000000",
  SUPERVISOR_API_TOKEN: "supervisor-secret-value-0000000000",
  OWNER_API_TOKEN: "owner-secret-value-000000000000000",
  DMP_API_TOKEN: "dmp-secret-value-00000000000000000",
  AUTH_SECRET: "auth-secret-value-00000000000000000",
  ADMIN_USER_ID: "1",
  TRAFFIC_OFFICER_USER_ID: "7",
  SUPERVISOR_USER_ID: "6",
  OWNER_USER_ID: "17",
  DMP_OFFICER_USER_ID: "12"
};

test("password login does not use DEMO env accounts and keeps role routes protected", async () => {
  const server = createApp(loginEnvironment).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const rejected = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner@example.test", password: "wrong-password" })
    });
    assert.ok([401, 503].includes(rejected.status));
    assert.equal(Object.hasOwn(await rejected.json(), "token"), false);

    const envBypass = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "owner@example.test", password: "Owner#TestOnly26" })
    });
    assert.notEqual(envBypass.status, 200);

    const ownerSession = signSession(
      { role: "owner", userId: 17, ownerId: 17 },
      loginEnvironment.AUTH_SECRET
    );
    const denied = await fetch(`${baseUrl}/api/database/tables`, {
      headers: { Authorization: `Bearer ${ownerSession}` }
    });
    assert.equal(denied.status, 403);

    const supervisorOnly = await fetch(`${baseUrl}/api/appeals/1/review`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginEnvironment.DMP_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ decision: "uphold", remarks: "not allowed" })
    });
    assert.equal(supervisorOnly.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
