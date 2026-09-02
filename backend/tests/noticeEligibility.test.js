import test from "node:test";
import assert from "node:assert/strict";
import { appealBlockReason, paymentBlockReason } from "../utils/noticeEligibility.js";

function fakeConnection({ payments = [], appeals = [] } = {}) {
  return {
    async execute(sql) {
      if (sql.includes("FROM PAYS")) return { rows: payments };
      if (sql.includes("FROM APPEAL")) return { rows: appeals };
      return { rows: [] };
    }
  };
}

test("unpaid notices with no appeal can be paid and appealed", async () => {
  const connection = fakeConnection();
  assert.equal(await paymentBlockReason(connection, 1), null);
  assert.equal(await appealBlockReason(connection, 1), null);
});

test("pending payment blocks pay and appeal", async () => {
  const connection = fakeConnection({ payments: [{ status: "Pending" }] });
  assert.match(await paymentBlockReason(connection, 1), /pending/i);
  assert.match(await appealBlockReason(connection, 1), /pending payment/i);
});

test("successful payment blocks pay and appeal", async () => {
  const connection = fakeConnection({ payments: [{ status: "Successful" }] });
  assert.match(await paymentBlockReason(connection, 1), /already been paid/i);
  assert.match(await appealBlockReason(connection, 1), /paid notice/i);
});

test("pending appeal blocks pay and a duplicate appeal", async () => {
  const connection = fakeConnection({ appeals: [{ status: "Pending" }] });
  assert.match(await paymentBlockReason(connection, 1), /appeal is pending/i);
  assert.match(await appealBlockReason(connection, 1), /already exists/i);
});

test("approved appeal blocks pay and a duplicate appeal", async () => {
  const connection = fakeConnection({ appeals: [{ status: "Approved" }] });
  assert.match(await paymentBlockReason(connection, 1), /dismissed/i);
  assert.match(await appealBlockReason(connection, 1), /already exists/i);
});

test("rejected appeal allows pay but not a duplicate appeal", async () => {
  const connection = fakeConnection({ appeals: [{ status: "Rejected" }] });
  assert.equal(await paymentBlockReason(connection, 1), null);
  assert.match(await appealBlockReason(connection, 1), /already exists/i);
});

test("Successful payment takes precedence when both payment rows are returned", async () => {
  const connection = fakeConnection({
    payments: [{ status: "Successful" }, { status: "Pending" }]
  });
  assert.match(await paymentBlockReason(connection, 1), /already been paid/i);
  assert.match(await appealBlockReason(connection, 1), /paid notice/i);
});
