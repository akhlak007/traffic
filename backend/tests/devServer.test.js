import test from "node:test";
import assert from "node:assert/strict";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePublicFile, createDevServer } from "../../dev-server.js";

const projectRoot = dirname(fileURLToPath(new URL("../../dev-server.js", import.meta.url)));

test("dev server allowlist rejects secrets, backend files, and path traversal", () => {
  assert.match(resolvePublicFile("/", projectRoot), /index\.html$/i);
  assert.match(resolvePublicFile("/pages/owner-dashboard.html", projectRoot), /owner-dashboard\.html$/i);
  assert.match(resolvePublicFile("/js/page.js", projectRoot), /page\.js$/i);
  assert.equal(resolvePublicFile("/backend/.env", projectRoot), null);
  assert.equal(resolvePublicFile("/backend/.env.example", projectRoot), null);
  assert.equal(resolvePublicFile("/.git/config", projectRoot), null);
  assert.equal(resolvePublicFile("/database/01_create_tables.sql", projectRoot), null);
  assert.equal(resolvePublicFile("/../backend/.env", projectRoot), null);
  assert.equal(resolvePublicFile("/js/../backend/.env", projectRoot), null);
  assert.equal(resolvePublicFile("/.env", projectRoot), null);
});

test("dev server does not serve backend/.env and does not use wildcard CORS", async () => {
  const server = createDevServer(projectRoot).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const env = await fetch(`${baseUrl}/backend/.env`);
    assert.equal(env.status, 404);
    assert.notEqual(env.headers.get("access-control-allow-origin"), "*");
    assert.equal(env.headers.get("access-control-allow-origin"), null);
    const example = await fetch(`${baseUrl}/backend/.env.example`);
    assert.equal(example.status, 404);
    const home = await fetch(`${baseUrl}/`, { headers: { Origin: "https://evil.example" } });
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("access-control-allow-origin"), null);
    assert.match(home.headers.get("content-security-policy") || "", /default-src 'self'/);
    assert.match(await home.text(), /Traffic AI Dhaka/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
