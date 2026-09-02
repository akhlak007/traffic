import test from "node:test";
import assert from "node:assert/strict";
import { RESOURCE_QUERIES } from "../controllers/resourceController.js";
import { VIEWABLE_TABLES } from "../controllers/databaseController.js";
import { isPositiveInteger, parseLimit } from "../utils/http.js";

test("all live screen resources have SQL contracts", () => {
  const required = [
    "cameras", "zones", "roadSegments", "users", "cameraEvents", "congestionEvents",
    "violationEvents", "evidence", "alertEvents", "roadDefectEvents",
    "suspiciousVehicleEvents", "riskAnalysis", "vehicleJourney"
  ];
  assert.deepEqual(Object.keys(RESOURCE_QUERIES).sort(), required.sort());
});

test("evaluation concepts are wired into runtime SQL", () => {
  assert.match(RESOURCE_QUERIES.congestionEvents, /CONGESTION_EVENT/);
  assert.match(RESOURCE_QUERIES.violationEvents, /Action_taken/);
});

test("database viewer excludes credential and payment tables", () => {
  for (const sensitive of ["USER", "PHONE", "PAYMENT", "BY_BANK", "BY_MFS", "PAYS", "OWNER_CREDENTIAL"]) {
    assert.equal(VIEWABLE_TABLES.has(sensitive), false);
  }
});

test("user list SQL does not expose Password_hash", () => {
  assert.doesNotMatch(RESOURCE_QUERIES.users, /Password_hash/i);
  assert.match(RESOURCE_QUERIES.users, /ua\.Email AS "email"/);
});

test("request number helpers clamp and validate", () => {
  assert.equal(parseLimit("500"), 100);
  assert.equal(parseLimit("25"), 25);
  assert.equal(parseLimit("invalid"), 100);
  assert.equal(isPositiveInteger("12"), true);
  assert.equal(isPositiveInteger("-1"), false);
});
