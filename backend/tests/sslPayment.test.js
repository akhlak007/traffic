import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createApp } from "../app.js";
import { paymentBlockReason, appealBlockReason } from "../utils/noticeEligibility.js";
import {
  amountsMatch,
  callbackUrls,
  createTranId,
  isSafeGatewayPageUrl,
  isSuccessfulValidationStatus,
  sslcommerzConfig
} from "../utils/sslGateway.js";
import { createSslcommerzClient } from "../services/sslcommerzClient.js";
import {
  finalizeValidatedAttempt,
  initiateSslPayment,
  persistGatewayAttemptStatus,
  persistGatewaySessionKey,
  reserveInitiatedGatewayAttempt,
  settleValidatedAttempt
} from "../controllers/sslPaymentController.js";

const root = new URL("../../", import.meta.url);

const environment = {
  CORS_ORIGINS: "http://127.0.0.1:4173",
  RATE_LIMIT_PER_MINUTE: "1000",
  ADMIN_API_TOKEN: "admin-secret-value-000000000000000",
  OFFICER_API_TOKEN: "officer-secret-value-0000000000000",
  SUPERVISOR_API_TOKEN: "supervisor-secret-value-0000000000",
  OWNER_API_TOKEN: "owner-secret-value-000000000000000",
  DMP_API_TOKEN: "dmp-secret-value-00000000000000000",
  AUTH_SECRET: "auth-secret-value-00000000000000000",
  SSLCOMMERZ_STORE_ID: "testbox",
  SSLCOMMERZ_STORE_PASSWORD: "placeholder-store-password",
  SSLCOMMERZ_IS_LIVE: "false",
  SSLCOMMERZ_CALLBACK_BASE_URL: "https://example.test"
};

async function withServer(callback) {
  const server = createApp(environment).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try { await callback(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function fakeConnection({ attempt, payments = [], appeals = [], insertPaymentId = 91 } = {}) {
  return {
    async execute(sql) {
      if (sql.includes("FROM SSL_GATEWAY_ATTEMPT")) return { rows: attempt ? [attempt] : [] };
      if (sql.includes("FROM PAYS") && /Status = 'Successful'/.test(sql)) {
        return { rows: payments.filter((row) => row.status === "Successful").map((row) => ({ paymentId: row.paymentId })) };
      }
      if (sql.includes("FROM PAYS")) return { rows: payments };
      if (sql.includes("FROM APPEAL")) return { rows: appeals };
      if (sql.includes("INSERT INTO PAYMENT")) return { outBinds: { paymentId: [insertPaymentId] } };
      return { rows: [] };
    }
  };
}

const initiatedAttempt = {
  id: 3,
  tranId: "STTESTTRAN01",
  ownerId: 17,
  noticeId: 8,
  expectedAmount: 1500,
  currency: "BDT",
  status: "Initiated",
  valId: null,
  paymentId: null
};

test("SSLCOMMERZ sandbox hosts and callback paths are official", () => {
  const config = sslcommerzConfig(environment);
  assert.equal(config.configured, true);
  assert.match(config.initiateUrl, /sandbox\.sslcommerz\.com\/gwprocess\/v4\/api\.php/);
  assert.match(config.validateUrl, /sandbox\.sslcommerz\.com\/validator\/api\/validationserverAPI\.php/);
  const urls = callbackUrls(config.callbackBase);
  assert.equal(urls.success, "https://example.test/api/payments/ssl/success");
  assert.equal(urls.fail, "https://example.test/api/payments/ssl/fail");
  assert.equal(urls.cancel, "https://example.test/api/payments/ssl/cancel");
  assert.equal(urls.ipn, "https://example.test/api/payments/ssl/ipn");
});

test("tran_id is unique, server-side, and within SSLCOMMERZ length", () => {
  const first = createTranId();
  const second = createTranId();
  assert.notEqual(first, second);
  assert.ok(first.length <= 30);
  assert.match(first, /^ST[a-z0-9]+$/i);
});

test("gateway URL allowlist accepts only the matching SSLCOMMERZ host", () => {
  assert.equal(isSafeGatewayPageUrl("https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=abc", false), true);
  assert.equal(isSafeGatewayPageUrl("https://evil.example/gw.php", false), false);
  assert.equal(isSafeGatewayPageUrl("https://securepay.sslcommerz.com/gwprocess/v4/gw.php", false), false);
});

test("amount and validation status helpers", () => {
  assert.equal(amountsMatch(1500, "1500.00"), true);
  assert.equal(amountsMatch(1500, "1499.50"), false);
  assert.equal(isSuccessfulValidationStatus("VALID"), true);
  assert.equal(isSuccessfulValidationStatus("VALIDATED"), true);
  assert.equal(isSuccessfulValidationStatus("INVALID_TRANSACTION"), false);
  assert.equal(isSuccessfulValidationStatus("FAILED"), false);
});

test("mocked SSLCOMMERZ client never uses a live network", async () => {
  const calls = [];
  const client = createSslcommerzClient({
    ...environment,
    SSLCOMMERZ_FETCH: async (url, options = {}) => {
      calls.push({ url: String(url), body: String(options.body || "") });
      return {
        async text() {
          return JSON.stringify({
            status: "SUCCESS",
            GatewayPageURL: "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=test"
          });
        }
      };
    }
  });
  const session = await client.initiateSession({ store_id: "testbox", total_amount: "10.00" });
  assert.equal(session.status, "SUCCESS");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /sandbox\.sslcommerz\.com/);
});

test("validated successful gateway attempt inserts PAYMENT and PAYS", async () => {
  const result = await finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
    tranId: "STTESTTRAN01",
    validation: {
      status: "VALID",
      tran_id: "STTESTTRAN01",
      val_id: "VAL1",
      amount: "1500.00",
      currency_type: "BDT",
      risk_level: 0
    }
  });
  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.paymentId, 91);
  assert.equal(result.noticeId, 8);
});

test("duplicate successful validation is idempotent", async () => {
  const result = await finalizeValidatedAttempt(fakeConnection({
    attempt: { ...initiatedAttempt, status: "Successful", paymentId: 77, valId: "VAL1" }
  }), {
    tranId: "STTESTTRAN01",
    validation: { status: "VALIDATED", tran_id: "STTESTTRAN01", val_id: "VAL1", amount: "1500.00", currency_type: "BDT" }
  });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.paymentId, 77);
});

test("invalid val_id, amount mismatch, currency mismatch, and tran_id mismatch are rejected", async () => {
  await assert.rejects(
    () => finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
      tranId: "STTESTTRAN01",
      validation: { status: "INVALID_TRANSACTION", tran_id: "STTESTTRAN01", val_id: "BAD", amount: "1500.00", currency_type: "BDT" }
    }),
    /not successful|invalid/i
  );
  await assert.rejects(
    () => finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
      tranId: "STTESTTRAN01",
      validation: { status: "VALID", tran_id: "STTESTTRAN01", val_id: "VAL1", amount: "1.00", currency_type: "BDT" }
    }),
    /amount/i
  );
  await assert.rejects(
    () => finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
      tranId: "STTESTTRAN01",
      validation: { status: "VALID", tran_id: "STTESTTRAN01", val_id: "VAL1", amount: "1500.00", currency_type: "USD" }
    }),
    /currency/i
  );
  await assert.rejects(
    () => finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
      tranId: "STTESTTRAN01",
      validation: { status: "VALID", tran_id: "OTHER", val_id: "VAL1", amount: "1500.00", currency_type: "BDT" }
    }),
    /Transaction id/i
  );
});

test("failed and cancelled statuses are not treated as successful validation", () => {
  assert.equal(isSuccessfulValidationStatus("FAILED"), false);
  assert.equal(isSuccessfulValidationStatus("CANCELLED"), false);
});

test("pending historical payment still blocks pay and is unchanged by gateway helpers", async () => {
  const connection = fakeConnection({ payments: [{ status: "Pending" }] });
  assert.match(await paymentBlockReason(connection, 1), /pending/i);
  assert.match(await appealBlockReason(connection, 1), /pending payment/i);
});

test("successful historical payment still blocks pay and appeal", async () => {
  const connection = fakeConnection({ payments: [{ status: "Successful" }] });
  assert.match(await paymentBlockReason(connection, 1), /already been paid/i);
  assert.match(await appealBlockReason(connection, 1), /paid notice/i);
});

test("initiate requires an authenticated owner and ignores browser amount", async () => {
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/payments/ssl/initiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId: 1, amount: 1 })
    });
    assert.equal(missing.status, 401);

    const forbidden = await fetch(`${baseUrl}/api/payments/ssl/initiate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${environment.ADMIN_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId: 1, amount: 1 })
    });
    assert.equal(forbidden.status, 403);

    const owner = await fetch(`${baseUrl}/api/payments/ssl/initiate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${environment.OWNER_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ noticeId: 1, amount: 1 })
    });
    const body = await owner.json();
    assert.notEqual(owner.status, 401);
    assert.equal(Object.hasOwn(body, "store_passwd"), false);
    assert.equal(Object.hasOwn(body, "SSLCOMMERZ_STORE_PASSWORD"), false);
    assert.doesNotMatch(JSON.stringify(body), /placeholder-store-password/);
  });
});

test("SSLCOMMERZ callbacks do not require the owner session", async () => {
  await withServer(async (baseUrl) => {
    const success = await fetch(`${baseUrl}/api/payments/ssl/success?tran_id=missing&val_id=missing`, { redirect: "manual" });
    assert.equal(success.status, 302);
    assert.match(success.headers.get("location"), /owner-notices\.html/);

    const fail = await fetch(`${baseUrl}/api/payments/ssl/fail?tran_id=missing`, { redirect: "manual" });
    assert.equal(fail.status, 302);
    assert.match(fail.headers.get("location"), /ssl=fail/);

    const cancel = await fetch(`${baseUrl}/api/payments/ssl/cancel?tran_id=missing`, { redirect: "manual" });
    assert.equal(cancel.status, 302);
    assert.match(cancel.headers.get("location"), /ssl=cancel/);

    const ipn = await fetch(`${baseUrl}/api/payments/ssl/ipn`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "status=FAILED&tran_id=missing"
    });
    assert.equal(ipn.status, 200);
    assert.equal(await ipn.text(), "IPN_FAILED");
  });
});

test("NOTICE has no Status column and SSL upgrade is additive", async () => {
  const ddl = await readFile(new URL("database/01_create_tables.sql", root), "utf8");
  const noticeBlock = ddl.slice(ddl.indexOf("CREATE TABLE NOTICE"), ddl.indexOf("CREATE TABLE PAYMENT"));
  assert.doesNotMatch(noticeBlock, /Status\s+VARCHAR2/);
  assert.match(ddl, /CREATE TABLE SSL_GATEWAY_ATTEMPT/);
  const upgrade = await readFile(new URL("database/06_upgrade_ssl_gateway.sql", root), "utf8");
  assert.match(upgrade, /SSL_GATEWAY_ATTEMPT/);
  assert.doesNotMatch(upgrade, /DROP TABLE/);
  assert.doesNotMatch(upgrade, /INSERT INTO/);
});

test("existing payment create path and eligibility are unchanged", async () => {
  const payment = await readFile(new URL("backend/controllers/paymentController.js", root), "utf8");
  const ssl = await readFile(new URL("backend/controllers/sslPaymentController.js", root), "utf8");
  const page = await readFile(new URL("js/page.js", root), "utf8");
  const eligibility = await readFile(new URL("backend/utils/noticeEligibility.js", root), "utf8");
  assert.match(payment, /SYSDATE, 'Successful'/);
  assert.match(payment, /req\.user\.ownerId/);
  assert.doesNotMatch(ssl, /req\.body\?\.amount|body\.amount/);
  assert.match(ssl, /paymentBlockReason/);
  assert.match(ssl, /req\.user\.ownerId/);
  assert.match(page, /\/ssl\/initiate/);
  assert.doesNotMatch(page, /localStorage[\s\S]*Paid/);
  assert.match(eligibility, /payment\.Status IN \('Pending', 'Successful'\)/);
});

test(".env.example documents SSLCOMMERZ placeholders only", async () => {
  const example = await readFile(new URL("backend/.env.example", root), "utf8");
  assert.match(example, /SSLCOMMERZ_STORE_ID=/);
  assert.match(example, /SSLCOMMERZ_STORE_PASSWORD=/);
  assert.match(example, /SSLCOMMERZ_IS_LIVE=false/);
  assert.match(example, /SSLCOMMERZ_CALLBACK_BASE_URL=/);
  assert.doesNotMatch(example, /qwerty/);
});

const validValidation = {
  status: "VALID",
  tran_id: "STTESTTRAN01",
  val_id: "VAL1",
  amount: "1500.00",
  currency_type: "BDT",
  risk_level: 0
};

function uniquePaysError() {
  const error = new Error("ORA-00001: unique constraint (SMART_TRAFFIC.UK_PAYS_NOTICE) violated");
  error.errorNum = 1;
  return error;
}

function recordingTransaction() {
  const statements = [];
  let committed = false;
  const runTransaction = async (callback) => {
    committed = false;
    const connection = {
      async execute(sql, binds = {}) {
        statements.push({ sql, binds });
        return { rows: [] };
      }
    };
    const result = await callback(connection);
    committed = true;
    return result;
  };
  return { statements, get committed() { return committed; }, runTransaction };
}

test("session_key update commits through a transaction", async () => {
  const txn = recordingTransaction();
  await persistGatewaySessionKey("STTESTTRAN01", "session-abc", txn.runTransaction);
  assert.equal(txn.committed, true);
  assert.equal(txn.statements.length, 1);
  assert.match(txn.statements[0].sql, /SET Session_key = :sessionKey/);
  assert.equal(txn.statements[0].binds.tranId, "STTESTTRAN01");
  assert.doesNotMatch(txn.statements[0].sql, /INSERT INTO PAYMENT|INSERT INTO PAYS/);
});

test("fail attempt status persists and does not insert PAYMENT or PAYS", async () => {
  const txn = recordingTransaction();
  await persistGatewayAttemptStatus("STTESTTRAN01", "Failed", txn.runTransaction);
  assert.equal(txn.committed, true);
  assert.equal(txn.statements[0].binds.status, "Failed");
  assert.match(txn.statements[0].sql, /SET Status = :status/);
  assert.match(txn.statements[0].sql, /Status <> 'Successful'/);
  assert.doesNotMatch(txn.statements.map((row) => row.sql).join("\n"), /INSERT INTO PAYMENT|INSERT INTO PAYS/);
});

test("cancel attempt status persists and does not insert PAYMENT or PAYS", async () => {
  const txn = recordingTransaction();
  await persistGatewayAttemptStatus("STTESTTRAN01", "Cancelled", txn.runTransaction);
  assert.equal(txn.committed, true);
  assert.equal(txn.statements[0].binds.status, "Cancelled");
  assert.doesNotMatch(txn.statements.map((row) => row.sql).join("\n"), /INSERT INTO PAYMENT|INSERT INTO PAYS/);
});

test("normal validated success inserts one Successful PAYMENT, one PAYS, and finalizes the attempt", async () => {
  const sql = [];
  const connection = fakeConnection({ attempt: initiatedAttempt });
  const original = connection.execute.bind(connection);
  connection.execute = async (statement, binds) => {
    sql.push(statement);
    return original(statement, binds);
  };
  const result = await finalizeValidatedAttempt(connection, { tranId: "STTESTTRAN01", validation: validValidation });
  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.paymentId, 91);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYMENT")).length, 1);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYS")).length, 1);
  assert.match(sql.find((value) => value.includes("UPDATE SSL_GATEWAY_ATTEMPT")), /Status = 'Successful'/);
});

test("duplicate success callback does not insert another PAYMENT or PAYS", async () => {
  const sql = [];
  const connection = fakeConnection({
    attempt: { ...initiatedAttempt, status: "Successful", paymentId: 77, valId: "VAL1" }
  });
  const original = connection.execute.bind(connection);
  connection.execute = async (statement, binds) => {
    sql.push(statement);
    return original(statement, binds);
  };
  const result = await finalizeValidatedAttempt(connection, {
    tranId: "STTESTTRAN01",
    validation: { ...validValidation, status: "VALIDATED" }
  });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.paymentId, 77);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYMENT")).length, 0);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYS")).length, 0);
});

test("success then IPN settles once", async () => {
  const first = await finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
    tranId: "STTESTTRAN01",
    validation: validValidation
  });
  const second = await finalizeValidatedAttempt(fakeConnection({
    attempt: { ...initiatedAttempt, status: "Successful", paymentId: first.paymentId, valId: "VAL1" }
  }), {
    tranId: "STTESTTRAN01",
    validation: { ...validValidation, status: "VALIDATED" }
  });
  assert.equal(first.alreadyProcessed, false);
  assert.equal(second.alreadyProcessed, true);
  assert.equal(second.paymentId, first.paymentId);
});

test("IPN then success settles once", async () => {
  const ipn = await finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
    tranId: "STTESTTRAN01",
    validation: { ...validValidation, status: "VALIDATED" }
  });
  const success = await finalizeValidatedAttempt(fakeConnection({
    attempt: { ...initiatedAttempt, status: "Successful", paymentId: ipn.paymentId, valId: "VAL1" }
  }), {
    tranId: "STTESTTRAN01",
    validation: validValidation
  });
  assert.equal(ipn.alreadyProcessed, false);
  assert.equal(success.alreadyProcessed, true);
  assert.equal(success.paymentId, ipn.paymentId);
});

test("PAYS unique race rolls back the new PAYMENT then reconciles the existing settlement", async () => {
  let phase = 0;
  const paymentInserts = [];
  const rolledBackPayments = [];
  const runTransaction = async (callback) => {
    phase += 1;
    const insertedThisTxn = [];
    const connection = {
      async execute(sql) {
        if (sql.includes("FROM SSL_GATEWAY_ATTEMPT")) return { rows: [{ ...initiatedAttempt }] };
        if (sql.includes("FROM NOTICE")) return { rows: [{ ID: 8 }] };
        if (sql.includes("INSERT INTO PAYMENT")) {
          insertedThisTxn.push(91);
          paymentInserts.push(91);
          return { outBinds: { paymentId: [91] } };
        }
        if (sql.includes("INSERT INTO PAYS")) throw uniquePaysError();
        if (sql.includes("FROM PAYS") && /Status = 'Successful'/.test(sql)) {
          return { rows: phase === 1 ? [] : [{ paymentId: 50 }] };
        }
        if (sql.includes("UPDATE SSL_GATEWAY_ATTEMPT")) return { rows: [] };
        return { rows: [] };
      }
    };
    try {
      return await callback(connection);
    } catch (error) {
      rolledBackPayments.push(...insertedThisTxn);
      throw error;
    }
  };

  const result = await settleValidatedAttempt({
    tranId: "STTESTTRAN01",
    validation: validValidation,
    runTransaction
  });
  assert.equal(phase, 2);
  assert.deepEqual(rolledBackPayments, [91]);
  assert.equal(paymentInserts.length - rolledBackPayments.length, 0);
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.paymentId, 50);
});

test("existing successful settlement is handled idempotently without a new PAYMENT", async () => {
  const sql = [];
  const connection = fakeConnection({
    attempt: initiatedAttempt,
    payments: [{ status: "Successful", paymentId: 44 }]
  });
  const original = connection.execute.bind(connection);
  connection.execute = async (statement, binds) => {
    sql.push(statement);
    return original(statement, binds);
  };
  const result = await finalizeValidatedAttempt(connection, { tranId: "STTESTTRAN01", validation: validValidation });
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.paymentId, 44);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYMENT")).length, 0);
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYS")).length, 0);
});

test("post-initiate appeal race still reconciles a validated captured payment", async () => {
  const result = await finalizeValidatedAttempt(fakeConnection({
    attempt: initiatedAttempt,
    appeals: [{ status: "Pending" }]
  }), { tranId: "STTESTTRAN01", validation: validValidation });
  assert.equal(result.alreadyProcessed, false);
  assert.equal(result.paymentId, 91);
});

test("initiation still rejects pending and approved appeals", async () => {
  const source = await readFile(new URL("backend/controllers/sslPaymentController.js", root), "utf8");
  const initiate = source.slice(source.indexOf("export async function initiateSslPayment"), source.indexOf("export async function sslSuccess"));
  const reserve = source.slice(source.indexOf("export async function reserveInitiatedGatewayAttempt"), source.indexOf("export async function settleValidatedAttempt"));
  const finalize = source.slice(source.indexOf("export async function finalizeValidatedAttempt"), source.indexOf("export async function persistGatewayAttemptStatus"));
  assert.match(initiate, /reserveInitiatedGatewayAttempt/);
  assert.match(reserve, /paymentBlockReason/);
  assert.doesNotMatch(finalize, /paymentBlockReason/);
  const pending = fakeConnection({ payments: [], appeals: [{ status: "Pending" }] });
  assert.match(await paymentBlockReason(pending, 8), /appeal is pending/i);
  const approved = fakeConnection({ payments: [], appeals: [{ status: "Approved" }] });
  assert.match(await paymentBlockReason(approved, 8), /dismissed/i);
});

test("amount mismatch is rejected with no settlement", async () => {
  const sql = [];
  const connection = fakeConnection({ attempt: initiatedAttempt });
  const original = connection.execute.bind(connection);
  connection.execute = async (statement, binds) => {
    sql.push(statement);
    return original(statement, binds);
  };
  await assert.rejects(
    () => finalizeValidatedAttempt(connection, {
      tranId: "STTESTTRAN01",
      validation: { ...validValidation, amount: "1.00" }
    }),
    /amount/i
  );
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYMENT")).length, 0);
});

test("invalid validation is rejected with no settlement", async () => {
  await assert.rejects(
    () => finalizeValidatedAttempt(fakeConnection({ attempt: initiatedAttempt }), {
      tranId: "STTESTTRAN01",
      validation: { ...validValidation, status: "FAILED" }
    }),
    /not successful/i
  );
});

test("unknown tran_id is rejected with no settlement", async () => {
  const sql = [];
  const connection = fakeConnection({ attempt: null });
  const original = connection.execute.bind(connection);
  connection.execute = async (statement, binds) => {
    sql.push(statement);
    return original(statement, binds);
  };
  await assert.rejects(
    () => finalizeValidatedAttempt(connection, { tranId: "UNKNOWN", validation: validValidation }),
    /not found/i
  );
  assert.equal(sql.filter((value) => value.includes("INSERT INTO PAYMENT")).length, 0);
});

test("standalone attempt updates use withTransaction rather than uncommitted execute", async () => {
  const source = await readFile(new URL("backend/controllers/sslPaymentController.js", root), "utf8");
  assert.match(source, /export async function persistGatewayAttemptStatus/);
  assert.match(source, /export async function persistGatewaySessionKey/);
  assert.match(source, /runTransaction = withTransaction/);
  assert.doesNotMatch(source, /from "\.\.\/config\/database\.js";\s*import \{ execute/);
  assert.doesNotMatch(source, /await execute\(/);
});

function jsonRes() {
  const captured = { statusCode: 200, body: null };
  return {
    captured,
    status(code) {
      captured.statusCode = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    }
  };
}

function ownerReq(noticeId = 8) {
  return { user: { ownerId: 17 }, body: { noticeId } };
}

function createInitiateHarness({
  payments = [],
  appeals = [],
  expireStale = false,
  sslResult = {
    status: "SUCCESS",
    GatewayPageURL: "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=test",
    sessionkey: "sess-1"
  },
  sslError = null
} = {}) {
  let committedActive = false;
  let treatAsExpired = expireStale;
  let currentSslResult = sslResult;
  let currentSslError = sslError;
  let lock = Promise.resolve();
  const statements = [];
  const inserts = [];
  const staleFailures = [];
  let sslCalls = 0;

  const runTransaction = async (callback) => {
    const previous = lock;
    let release;
    lock = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const connection = {
        async execute(sql, binds = {}) {
          statements.push({ sql, binds });
          if (sql.includes("JOIN INVOLVED_IN") && sql.includes("FOR UPDATE")) {
            return { rows: [{ noticeId: 8, fineAmount: 1500 }] };
          }
          if (sql.includes("FROM PAYS")) return { rows: payments };
          if (sql.includes("FROM APPEAL")) return { rows: appeals };
          if (sql.includes("FROM SSL_GATEWAY_ATTEMPT") && sql.includes("Created_at >")) {
            return { rows: committedActive && !treatAsExpired ? [{ id: 1 }] : [] };
          }
          if (sql.includes("SET Status = 'Failed'") && sql.includes("Created_at <=")) {
            staleFailures.push(binds);
            return { rowsAffected: treatAsExpired ? 1 : 0 };
          }
          if (sql.includes("INSERT INTO SSL_GATEWAY_ATTEMPT")) {
            inserts.push({ ...binds });
            return { rows: [] };
          }
          if (sql.includes("SET Session_key")) return { rows: [] };
          if (sql.includes("SET Status = :status")) {
            if (binds.status === "Failed" || binds.status === "Cancelled") committedActive = false;
            return { rows: [] };
          }
          if (sql.includes('FROM "USER"')) {
            return { rows: [{ name: "Arif Owner", email: "arif@example.test", address: "Dhaka" }] };
          }
          if (sql.includes("FROM PHONE")) return { rows: [{ phone: "01700000000" }] };
          return { rows: [] };
        }
      };
      const insertedBefore = inserts.length;
      const result = await callback(connection);
      if (inserts.length > insertedBefore) {
        committedActive = true;
        treatAsExpired = false;
      }
      return result;
    } finally {
      release();
    }
  };

  const sslClient = {
    async initiateSession() {
      sslCalls += 1;
      if (currentSslError) throw currentSslError;
      return currentSslResult;
    }
  };

  return {
    statements,
    inserts,
    staleFailures,
    get sslCalls() { return sslCalls; },
    expireNow() { treatAsExpired = true; },
    setSslError(error) { currentSslError = error; },
    setSslResult(result) {
      currentSslError = null;
      currentSslResult = result;
    },
    runTransaction,
    sslClient,
    deps: { runTransaction, sslClient }
  };
}

test("first eligible initiation reserves one attempt and calls SSLCOMMERZ once", async () => {
  const harness = createInitiateHarness();
  const res = jsonRes();
  await initiateSslPayment(ownerReq(), res, environment, harness.deps);
  assert.equal(res.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.sslCalls, 1);
  assert.match(res.captured.body.gatewayPageUrl, /sandbox\.sslcommerz\.com/);
});

test("second initiation while first is active is blocked and does not call SSLCOMMERZ", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  const second = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  await initiateSslPayment(ownerReq(), second, environment, harness.deps);
  assert.equal(first.captured.statusCode, 201);
  assert.equal(second.captured.statusCode, 409);
  assert.equal(second.captured.body.error, "Payment session already in progress");
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.sslCalls, 1);
});

test("two concurrent initiations allow only one active SSLCOMMERZ session", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  const second = jsonRes();
  await Promise.all([
    initiateSslPayment(ownerReq(), first, environment, harness.deps),
    initiateSslPayment(ownerReq(), second, environment, harness.deps)
  ]);
  const statuses = [first.captured.statusCode, second.captured.statusCode].sort();
  assert.deepEqual(statuses, [201, 409]);
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.sslCalls, 1);
});

test("failed attempt allows retry with a new SSLCOMMERZ session", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  await persistGatewayAttemptStatus(first.captured.body.tranId, "Failed", harness.runTransaction);
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 2);
  assert.equal(harness.sslCalls, 2);
  assert.notEqual(retry.captured.body.tranId, first.captured.body.tranId);
});

test("cancelled attempt allows retry with a new SSLCOMMERZ session", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  await persistGatewayAttemptStatus(first.captured.body.tranId, "Cancelled", harness.runTransaction);
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 2);
  assert.equal(harness.sslCalls, 2);
});

test("successful paid notice remains blocked from a new gateway session", async () => {
  const harness = createInitiateHarness({ payments: [{ status: "Successful" }] });
  const res = jsonRes();
  await initiateSslPayment(ownerReq(), res, environment, harness.deps);
  assert.equal(res.captured.statusCode, 409);
  assert.match(res.captured.body.error, /already been paid/i);
  assert.equal(harness.inserts.length, 0);
  assert.equal(harness.sslCalls, 0);
});

test("external SSLCOMMERZ initiation failure marks the reserved attempt Failed", async () => {
  const harness = createInitiateHarness({ sslError: new Error("network down") });
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  assert.equal(first.captured.statusCode, 500);
  assert.equal(harness.inserts.length, 1);
  assert.equal(harness.sslCalls, 1);
  harness.setSslError(null);
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 2);
  assert.equal(harness.sslCalls, 2);
});

test("invalid GatewayPageURL marks the reserved attempt Failed and allows retry", async () => {
  const harness = createInitiateHarness({
    sslResult: { status: "FAILED", GatewayPageURL: "https://evil.example/pay" }
  });
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  assert.equal(first.captured.statusCode, 502);
  harness.setSslResult({
    status: "SUCCESS",
    GatewayPageURL: "https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?Q=retry",
    sessionkey: "sess-2"
  });
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 2);
});

test("abandoned initiated attempt older than Created_at timeout can retry", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  assert.equal(first.captured.statusCode, 201);
  harness.expireNow();
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.ok(harness.staleFailures.length >= 1);
  assert.equal(harness.inserts.length, 2);
  assert.notEqual(retry.captured.body.tranId, first.captured.body.tranId);
  assert.match(harness.statements.find((row) => row.sql.includes("Created_at <=")).sql, /Status = 'Failed'/);
});

test("retry inserts a new attempt and does not mark the old Failed or Cancelled row Successful", async () => {
  const harness = createInitiateHarness();
  const first = jsonRes();
  await initiateSslPayment(ownerReq(), first, environment, harness.deps);
  await persistGatewayAttemptStatus(first.captured.body.tranId, "Failed", harness.runTransaction);
  const retry = jsonRes();
  await initiateSslPayment(ownerReq(), retry, environment, harness.deps);
  assert.equal(retry.captured.statusCode, 201);
  assert.equal(harness.inserts.length, 2);
  assert.equal(
    harness.statements.some((row) => row.sql.includes("SET Status = 'Successful'") && row.binds?.tranId === first.captured.body.tranId),
    false
  );
});

test("reserveInitiatedGatewayAttempt does not call SSLCOMMERZ", async () => {
  const connection = {
    async execute(sql) {
      if (sql.includes("FROM PAYS") || sql.includes("FROM APPEAL")) return { rows: [] };
      if (sql.includes("Created_at >")) return { rows: [] };
      return { rows: [] };
    }
  };
  const reserved = await reserveInitiatedGatewayAttempt(connection, {
    noticeId: 8,
    ownerId: 17,
    fineAmount: 1500
  });
  assert.match(reserved.tranId, /^ST/i);
});
