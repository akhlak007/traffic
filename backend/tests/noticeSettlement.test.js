import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { statusColor } from "../../js/components/ui.js";
import {
  noticeCanAppeal,
  noticeCanPay,
  noticeStatusLabel,
  presentNoticeRow,
  resolveNoticeStatus
} from "../../js/noticeState.js";

const root = new URL("../../", import.meta.url);

test("NOTICE table has no Status column; PAYMENT.Status is the settlement source", async () => {
  const ddl = await readFile(new URL("database/01_create_tables.sql", root), "utf8");
  const noticeBlock = ddl.slice(ddl.indexOf("CREATE TABLE NOTICE"), ddl.indexOf("CREATE TABLE PAYMENT"));
  assert.doesNotMatch(noticeBlock, /Status\s+VARCHAR2/);
  assert.match(ddl, /CREATE TABLE PAYMENT/);
  assert.match(ddl, /CK_PAYMENT_STATUS/);
  assert.match(ddl, /'Pending',\s*'Successful',\s*'Failed',\s*'Refunded'/);
  assert.match(ddl, /CONSTRAINT UK_PAYS_NOTICE/);
});

test("notice API derives paid only from Successful payments, not from PAYS existence", async () => {
  const source = await readFile(new URL("backend/controllers/noticeController.js", root), "utf8");
  const paidFirst = source.indexOf("payment.Status = 'Successful'");
  const pendingLater = source.indexOf("payment.Status = 'Pending'");
  assert.ok(paidFirst > 0 && pendingLater > paidFirst);
  assert.match(source, /THEN 'paid'/);
  assert.match(source, /THEN 'payment-pending'/);
  assert.match(source, /END AS "paymentStatus"/);
  assert.match(source, /FROM PAYS p/);
  assert.match(source, /JOIN PAYMENT payment ON payment\.ID = p\.Payment_id/);
  assert.match(source, /p\.Notice_id = n\.ID/);
  assert.match(source, /Vehicle_owner_id = :ownerId/);
  assert.match(source, /presentNoticeRow/);
});

test("successful payment is inserted in one transaction using the session owner", async () => {
  const source = await readFile(new URL("backend/controllers/paymentController.js", root), "utf8");
  assert.match(source, /withTransaction/);
  assert.match(source, /SYSDATE, 'Successful'/);
  assert.match(source, /req\.user\.ownerId/);
  assert.match(source, /paymentBlockReason/);
  assert.doesNotMatch(source, /UPDATE NOTICE/);
  assert.doesNotMatch(source, /req\.body\?\.ownerId|body\.ownerId/);
});

test("appeal create uses session owner and blocks paid or pending-payment notices", async () => {
  const source = await readFile(new URL("backend/controllers/appealController.js", root), "utf8");
  assert.match(source, /appealBlockReason/);
  assert.match(source, /req\.user\.ownerId/);
  assert.match(source, /withTransaction/);
  assert.doesNotMatch(source, /req\.body\?\.ownerId|body\.ownerId/);
});

test("transaction helper rolls back when a step fails", async () => {
  const source = await readFile(new URL("backend/config/database.js", root), "utf8");
  assert.match(source, /await connection\.commit\(\)/);
  assert.match(source, /await connection\.rollback\(\)/);
});

test("display colors treat Unpaid as open and Paid as settled", () => {
  assert.equal(statusColor("Unpaid"), "var(--color-warning)");
  assert.equal(statusColor("Paid"), "var(--color-success)");
  assert.equal(statusColor("Payment Pending"), "var(--color-warning)");
});

test("no payment is Unpaid and eligible for pay and appeal", () => {
  const notice = presentNoticeRow({ status: "pending", canPay: 1, canAppeal: 1 });
  assert.equal(notice.displayStatus, "Unpaid");
  assert.equal(noticeStatusLabel(notice), "Unpaid");
  assert.equal(notice.canPay, true);
  assert.equal(notice.canAppeal, true);
});

test("pending payment is Payment Pending and blocks pay and appeal", () => {
  const notice = presentNoticeRow({
    status: "payment-pending",
    paymentStatus: "Pending",
    canPay: 0,
    canAppeal: 0
  });
  assert.equal(notice.displayStatus, "Payment Pending");
  assert.equal(notice.paymentStatus, "Pending");
  assert.equal(notice.canPay, false);
  assert.equal(notice.canAppeal, false);
});

test("successful payment is Paid and blocks pay and appeal", () => {
  const notice = presentNoticeRow({
    status: "paid",
    paymentStatus: "Successful",
    canPay: 0,
    canAppeal: 0
  });
  assert.equal(notice.displayStatus, "Paid");
  assert.equal(notice.paymentStatus, "Successful");
  assert.equal(notice.canPay, false);
  assert.equal(notice.canAppeal, false);
});

test("successful payment cannot still visually display Pending", () => {
  const stale = presentNoticeRow({
    status: "pending",
    paymentStatus: "Successful",
    canPay: 1,
    canAppeal: 1
  });
  assert.equal(resolveNoticeStatus(stale), "paid");
  assert.equal(noticeStatusLabel(stale), "Paid");
  assert.equal(stale.displayStatus, "Paid");
  assert.doesNotMatch(stale.displayStatus, /pending/i);
  assert.equal(noticeCanPay(stale), false);
  assert.equal(noticeCanAppeal(stale), false);
});

test("rejected appeal with no payment allows pay but not a second appeal", () => {
  const notice = presentNoticeRow({
    status: "appeal-rejected",
    canPay: 1,
    canAppeal: 0
  });
  assert.equal(notice.displayStatus, "Appeal Rejected");
  assert.equal(notice.canPay, true);
  assert.equal(notice.canAppeal, false);
  assert.equal(noticeCanPay(notice), true);
  assert.equal(noticeCanAppeal(notice), false);
});

test("pending and approved appeals block pay and appeal", () => {
  const pending = presentNoticeRow({ status: "appealed", canPay: 0, canAppeal: 0 });
  assert.equal(pending.displayStatus, "Appeal Pending");
  assert.equal(pending.canPay, false);
  assert.equal(pending.canAppeal, false);
  const approved = presentNoticeRow({ status: "dismissed", canPay: 0, canAppeal: 0 });
  assert.equal(approved.displayStatus, "Appeal Approved");
  assert.equal(approved.canPay, false);
  assert.equal(approved.canAppeal, false);
});

test("eligibility SQL prefers Successful over Pending and joins NOTICE to PAYS to PAYMENT", async () => {
  const source = await readFile(new URL("backend/utils/noticeEligibility.js", root), "utf8");
  assert.match(source, /FROM PAYS p/);
  assert.match(source, /JOIN PAYMENT payment ON payment\.ID = p\.Payment_id/);
  assert.match(source, /p\.Notice_id = :noticeId/);
  const successfulRank = source.indexOf("WHEN 'Successful' THEN 1");
  const pendingRank = source.indexOf("WHEN 'Pending' THEN 2");
  assert.ok(successfulRank > 0 && pendingRank > successfulRank);
});

test("owner notice pages render labels from the same derived notice state", async () => {
  const page = await readFile(new URL("js/page.js", root), "utf8");
  assert.match(page, /from "\.\/noticeState\.js"/);
  assert.match(page, /noticeStatusLabel\(n\)/);
  assert.match(page, /noticeStatusLabel\(notice\)/);
  assert.match(page, /resolveNoticeStatus\(notice\) === "paid"/);
});

test("notice API returns VIOLATION_EVENT.Type by joining NOTICE to the event", async () => {
  const source = await readFile(new URL("backend/controllers/noticeController.js", root), "utf8");
  assert.match(source, /ve\.Type AS "violationType"/);
  assert.match(source, /JOIN VIOLATION_EVENT ve ON ve\.ID = n\.Violation_event_id/);
  assert.match(source, /n\.Issue_date AS "issueDate"/);
  assert.match(source, /n\.Due_date AS "dueDate"/);
  assert.doesNotMatch(source, /NOTICE\.Status|n\.Status/);
});

test("faculty seed labels the paid Zubaer notice as paid, not open", async () => {
  const seed = await readFile(new URL("backend/scripts/seed-faculty-demo.mjs", root), "utf8");
  assert.match(seed, /"FACULTY-ZUBAER-PAID-3": \{ issueDaysAgo: 10/);
  assert.doesNotMatch(seed, /"FACULTY-ZUBAER-OPEN": \{/);
  assert.match(seed, /"FACULTY-ZUBAER-PAID-3", paidCSchedule/);
  assert.match(seed, /oldRemark: "FACULTY-ZUBAER-OPEN"/);
  assert.match(seed, /newRemark: "FACULTY-ZUBAER-PAID-3"/);
});

test("notice cards do not special-case notice 21 or hardcode overdue", async () => {
  const page = await readFile(new URL("js/page.js", root), "utf8");
  const state = await readFile(new URL("js/noticeState.js", root), "utf8");
  assert.doesNotMatch(page, /noticeId\s*===\s*21|notice\.id\s*===\s*21/);
  assert.doesNotMatch(page, /status\s*=\s*['"]overdue['"]/);
  assert.doesNotMatch(state, /noticeId\s*===\s*21/);
});

test("owner notices toolbar omits the generic pending chip and filters by exact status key", async () => {
  const page = await readFile(new URL("js/page.js", root), "utf8");
  const ui = await readFile(new URL("js/components/ui.js", root), "utf8");
  assert.match(page, /toolbar\(\["paid","appealed","overdue","dismissed","payment-pending","appeal-rejected"\]\)/);
  assert.match(page, /noticeViolationType\(n\)/);
  assert.match(page, /noticeViolationId\(n\)/);
  assert.match(ui, /statusKey === active\.toLowerCase\(\)/);
});
