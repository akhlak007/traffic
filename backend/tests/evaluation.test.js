import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);

test("all role navigation targets exist", async () => {
  const shell = await readFile(new URL("js/shell.js", root), "utf8");
  const links = [...shell.matchAll(/"([a-z-]+\.html)"/g)].map((match) => match[1]).filter((link) => link !== "index.html");
  assert.ok(links.length >= 15);
  await Promise.all(links.map((link) => readFile(new URL(`pages/${link}`, root), "utf8")));
});

test("required frontend pages expose natural database demonstrations", async () => {
  const page = await readFile(new URL("js/page.js", root), "utf8");
  for (const marker of ["cameraAverageReport", "pendingAppealSummary", "pendingAppealsReport", "vehicleProfileReport", "vehicleViolationsReport", "data-verification-form", "congestionEvents", "Payment history"]) {
    assert.match(page, new RegExp(marker));
  }
});

test("upgrade script contains callable Oracle concepts", async () => {
  const sql = await readFile(new URL("database/05_upgrade_evaluation_objects.sql", root), "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION FN_VIOLATION_COUNT/);
  assert.match(sql, /CREATE OR REPLACE VIEW VEHICLE_VIOLATION_VIEW/);
  assert.match(sql, /CREATE OR REPLACE TYPE VEHICLE_REPORT_TYPE/);
  assert.match(sql, /CREATE OR REPLACE PROCEDURE PR_GET_PENDING_APPEALS/);
  assert.match(sql, /CURSOR pending_appeal_cursor IS/);
  assert.match(sql, /FETCH pending_appeal_cursor INTO/);
  assert.match(sql, /EXCEPTION[\s\S]*DUP_VAL_ON_INDEX/);
});

test("evaluation controller still calls Update-2 procedures and views", async () => {
  const source = await readFile(new URL("backend/controllers/evaluationController.js", root), "utf8");
  assert.match(source, /GET_PENDING_APPEAL_SUMMARY/);
  assert.match(source, /WHEN TOO_MANY_ROWS THEN/);
  assert.match(source, /VEHICLE_VIOLATION_VIEW/);
  assert.match(source, /FROM VEHICLE_REPORT r/);
  assert.match(source, /r\.Report\.Owner_name/);
  assert.match(source, /WHEN NO_DATA_FOUND THEN/);
  assert.match(source, /cameras-above-average|AVG\(Event_count\)/);
});
