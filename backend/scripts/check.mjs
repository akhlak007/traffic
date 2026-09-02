import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(backendRoot, "..");
const failures = [];
let javascriptCount = 0;
let jsonCount = 0;
let htmlCount = 0;

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    if ([".git", "node_modules", "test-results", "playwright-report"].includes(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(projectRoot);
for (const file of files) {
  const extension = extname(file).toLowerCase();
  if ([".js", ".mjs"].includes(extension)) {
    javascriptCount += 1;
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`JavaScript syntax: ${relative(projectRoot, file)}\n${result.stderr}`);
  }
  if (extension === ".json") {
    jsonCount += 1;
    try { JSON.parse(readFileSync(file, "utf8")); }
    catch (error) { failures.push(`JSON parse: ${relative(projectRoot, file)}: ${error.message}`); }
  }
  if (extension === ".html") {
    htmlCount += 1;
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      const reference = match[1];
      if (/^(?:https?:|#|data:|mailto:|javascript:)/.test(reference)) continue;
      const localPart = reference.split(/[?#]/)[0];
      if (!localPart) continue;
      const target = resolve(dirname(file), localPart);
      try { statSync(target); }
      catch { failures.push(`Missing HTML reference: ${relative(projectRoot, file)} -> ${reference}`); }
    }
  }
}

const ddl = readFileSync(join(projectRoot, "database", "01_create_tables.sql"), "utf8");
const seed = readFileSync(join(projectRoot, "database", "02_insert_demo_data.sql"), "utf8");
const teardown = readFileSync(join(projectRoot, "database", "04_drop_tables.sql"), "utf8");
const upgrade = readFileSync(join(projectRoot, "database", "05_upgrade_evaluation_objects.sql"), "utf8");
const tableNames = [...ddl.matchAll(/CREATE\s+TABLE\s+(?:"([^"]+)"|([A-Z_]+))/gi)]
  .map((match) => (match[1] || match[2]).toUpperCase());
for (const tableName of tableNames) {
  if (!teardown.includes(`'${tableName}'`)) failures.push(`Teardown omits table: ${tableName}`);
}

const plateColumn = /Licence_plate_no\s+VARCHAR2\((\d+)\)/i.exec(ddl);
const plateLimit = Number(plateColumn?.[1] || 0);
const seededPlates = [...seed.matchAll(/'((?:DHAKA-METRO)-[A-Z]+-[0-9]+-[0-9]+)'/g)].map((match) => match[1]);
if (!plateLimit || seededPlates.some((plate) => plate.length > plateLimit)) {
  failures.push(`Seeded licence plate exceeds VARCHAR2(${plateLimit || "unknown"})`);
}
if (/(?:Admin|Traffic|Dmp|Owner)@\d{3}/.test(seed)) failures.push("Demo seed contains plaintext password-like values");

for (const objectName of [
  "FN_VIOLATION_COUNT", "VEHICLE_VIOLATION_VIEW", "VEHICLE_REPORT_TYPE",
  "VEHICLE_REPORT", "PENDING_APPEAL_LIST", "PR_GET_PENDING_APPEALS", "PR_VERIFY_VIOLATION"
]) {
  if (!upgrade.includes(objectName)) failures.push(`Upgrade omits evaluation object: ${objectName}`);
  if (!teardown.includes(objectName)) failures.push(`Teardown omits evaluation object: ${objectName}`);
}
for (const concept of ["CREATE OR REPLACE FUNCTION", "CREATE OR REPLACE VIEW", "CREATE OR REPLACE TYPE", "CURSOR pending_appeal_cursor", "EXCEPTION", "RAISE_APPLICATION_ERROR"]) {
  if (!upgrade.includes(concept)) failures.push(`Oracle evaluation concept missing: ${concept}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Static checks passed: ${javascriptCount} JavaScript, ${jsonCount} JSON, ${htmlCount} HTML, ${tableNames.length} Oracle tables.`);
