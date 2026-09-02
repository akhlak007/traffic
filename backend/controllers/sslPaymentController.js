import oracledb from "oracledb";
import { withTransaction } from "../config/database.js";
import { isPositiveInteger, reportDatabaseError } from "../utils/http.js";
import { paymentBlockReason } from "../utils/noticeEligibility.js";
import { createSslcommerzClient } from "../services/sslcommerzClient.js";
import {
  amountsMatch,
  callbackUrls,
  createTranId,
  frontendNoticesUrl,
  gatewayFields,
  isSafeGatewayPageUrl,
  isSuccessfulValidationStatus,
  sslcommerzConfig
} from "../utils/sslGateway.js";

class GatewayRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const ACTIVE_GATEWAY_ATTEMPT_MINUTES = 15;

const NOTICE_OWNER_SQL = `
        SELECT n.ID AS "noticeId", n.Fine_amount AS "fineAmount"
        FROM NOTICE n
        JOIN INVOLVED_IN ii ON ii.Violation_event_id = n.Violation_event_id
        JOIN VEHICLE v ON v.ID = ii.Vehicle_id
        WHERE n.ID = :noticeId AND v.Vehicle_owner_id = :ownerId
          AND (SELECT COUNT(*) FROM INVOLVED_IN own_ii WHERE own_ii.Violation_event_id = n.Violation_event_id) = 1`;

function clientFor(environment) {
  return createSslcommerzClient(environment);
}

async function ownerProfile(connection, ownerId) {
  const user = await connection.execute(
    `SELECT TRIM(u.First_name || ' ' || u.Last_name) AS "name",
            u.Email AS "email",
            vo.Address AS "address"
     FROM "USER" u
     JOIN VEHICLE_OWNER vo ON vo.ID = u.ID
     WHERE u.ID = :ownerId`,
    { ownerId }
  );
  const phone = await connection.execute(
    `SELECT Phone_number AS "phone" FROM PHONE WHERE User_id = :ownerId AND ROWNUM = 1`,
    { ownerId }
  );
  const row = user.rows?.[0] || {};
  return {
    name: String(row.name || "Vehicle Owner").slice(0, 50),
    email: String(row.email || "owner@traffic.local").slice(0, 50),
    address: String(row.address || "Dhaka").slice(0, 50),
    phone: String(phone.rows?.[0]?.phone || "01700000000").slice(0, 20)
  };
}

export async function finalizeValidatedAttempt(connection, {
  tranId,
  validation,
  ownerId
}) {
  if (!isSuccessfulValidationStatus(validation?.status)) {
    throw new GatewayRequestError(409, "SSLCOMMERZ validation status is not successful");
  }
  if (String(validation?.status || "").toUpperCase() === "INVALID_TRANSACTION") {
    throw new GatewayRequestError(409, "SSLCOMMERZ validation id is invalid");
  }
  if (Number(validation?.risk_level) === 1) {
    throw new GatewayRequestError(409, "SSLCOMMERZ marked this transaction as high risk");
  }

  const attempt = await connection.execute(
    `SELECT ID AS "id", Tran_id AS "tranId", Vehicle_owner_id AS "ownerId", Notice_id AS "noticeId",
            Expected_amount AS "expectedAmount", Currency AS "currency", Status AS "status",
            Val_id AS "valId", Payment_id AS "paymentId"
     FROM SSL_GATEWAY_ATTEMPT
     WHERE Tran_id = :tranId
     FOR UPDATE`,
    { tranId }
  );
  const local = attempt.rows?.[0];
  if (!local) throw new GatewayRequestError(404, "Gateway transaction not found");
  if (ownerId && Number(local.ownerId) !== Number(ownerId)) {
    throw new GatewayRequestError(403, "Gateway transaction does not belong to this owner");
  }
  if (String(validation.tran_id) !== String(local.tranId)) {
    throw new GatewayRequestError(409, "Transaction id does not match the initiated payment");
  }
  if (!amountsMatch(local.expectedAmount, validation.amount) && !amountsMatch(local.expectedAmount, validation.currency_amount)) {
    throw new GatewayRequestError(409, "Validated amount does not match the notice fine");
  }
  const currency = String(validation.currency_type || validation.currency || "").toUpperCase();
  if (currency && currency !== String(local.currency).toUpperCase()) {
    throw new GatewayRequestError(409, "Validated currency does not match BDT");
  }

  if (local.status === "Successful" && local.paymentId) {
    return { alreadyProcessed: true, paymentId: local.paymentId, noticeId: local.noticeId };
  }

  await connection.execute(
    `SELECT ID FROM NOTICE WHERE ID = :noticeId FOR UPDATE`,
    { noticeId: local.noticeId }
  );

  const existingPaid = await connection.execute(
    `SELECT payment.ID AS "paymentId"
     FROM PAYS p
     JOIN PAYMENT payment ON payment.ID = p.Payment_id
     WHERE p.Notice_id = :noticeId AND payment.Status = 'Successful'`,
    { noticeId: local.noticeId }
  );
  if (existingPaid.rows?.length) {
    await connection.execute(
      `UPDATE SSL_GATEWAY_ATTEMPT
       SET Status = 'Successful', Val_id = :valId, Payment_id = :paymentId, Updated_at = SYSDATE
       WHERE ID = :id`,
      { valId: validation.val_id || null, paymentId: existingPaid.rows[0].paymentId, id: local.id }
    );
    return { alreadyProcessed: true, paymentId: existingPaid.rows[0].paymentId, noticeId: local.noticeId };
  }

  const insert = await connection.execute(
    `INSERT INTO PAYMENT (Payment_date, Status, Amount)
     VALUES (SYSDATE, 'Successful', :amount)
     RETURNING ID INTO :paymentId`,
    {
      amount: local.expectedAmount,
      paymentId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    }
  );
  const paymentId = insert.outBinds.paymentId[0];
  await connection.execute(
    `INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id)
     VALUES (:paymentId, :ownerId, :noticeId)`,
    { paymentId, ownerId: local.ownerId, noticeId: local.noticeId }
  );
  await connection.execute(
    `UPDATE SSL_GATEWAY_ATTEMPT
     SET Status = 'Successful', Val_id = :valId, Payment_id = :paymentId, Updated_at = SYSDATE
     WHERE ID = :id`,
    { valId: validation.val_id || null, paymentId, id: local.id }
  );
  return { alreadyProcessed: false, paymentId, noticeId: local.noticeId };
}

export async function persistGatewayAttemptStatus(tranId, status, runTransaction = withTransaction) {
  if (!tranId) return;
  if (status !== "Failed" && status !== "Cancelled") return;
  try {
    await runTransaction(async (connection) => {
      await connection.execute(
        `UPDATE SSL_GATEWAY_ATTEMPT
         SET Status = :status, Updated_at = SYSDATE
         WHERE Tran_id = :tranId AND Status <> 'Successful'`,
        { status, tranId }
      );
    });
  } catch {
    return;
  }
}

export async function persistGatewaySessionKey(tranId, sessionKey, runTransaction = withTransaction) {
  if (!tranId) return;
  await runTransaction(async (connection) => {
    await connection.execute(
      `UPDATE SSL_GATEWAY_ATTEMPT
       SET Session_key = :sessionKey, Updated_at = SYSDATE
       WHERE Tran_id = :tranId AND Status <> 'Successful'`,
      { sessionKey, tranId }
    );
  });
}

export async function reserveInitiatedGatewayAttempt(connection, { noticeId, ownerId, fineAmount }) {
  const blocked = await paymentBlockReason(connection, Number(noticeId));
  if (blocked) throw new GatewayRequestError(409, blocked);

  const active = await connection.execute(
    `SELECT ID AS "id"
     FROM SSL_GATEWAY_ATTEMPT
     WHERE Notice_id = :noticeId
       AND Status = 'Initiated'
       AND Created_at > SYSDATE - (:minutes / 1440)`,
    { noticeId: Number(noticeId), minutes: ACTIVE_GATEWAY_ATTEMPT_MINUTES }
  );
  if (active.rows?.length) {
    throw new GatewayRequestError(409, "Payment session already in progress");
  }

  await connection.execute(
    `UPDATE SSL_GATEWAY_ATTEMPT
     SET Status = 'Failed', Updated_at = SYSDATE
     WHERE Notice_id = :noticeId
       AND Status = 'Initiated'
       AND Created_at <= SYSDATE - (:minutes / 1440)`,
    { noticeId: Number(noticeId), minutes: ACTIVE_GATEWAY_ATTEMPT_MINUTES }
  );

  const tranId = createTranId();
  await connection.execute(
    `INSERT INTO SSL_GATEWAY_ATTEMPT
      (Tran_id, Vehicle_owner_id, Notice_id, Expected_amount, Currency, Status)
     VALUES (:tranId, :ownerId, :noticeId, :amount, 'BDT', 'Initiated')`,
    { tranId, ownerId, noticeId: Number(noticeId), amount: fineAmount }
  );
  return { tranId };
}

export async function settleValidatedAttempt({
  tranId,
  validation,
  ownerId,
  runTransaction = withTransaction
}) {
  try {
    return await runTransaction((connection) => finalizeValidatedAttempt(connection, { tranId, validation, ownerId }));
  } catch (error) {
    if (Number(error.errorNum) !== 1) throw error;
    return runTransaction((connection) => finalizeValidatedAttempt(connection, { tranId, validation, ownerId }));
  }
}

async function processValidatedCallback(environment, fields) {
  const tranId = String(fields.tran_id || "").trim();
  const valId = String(fields.val_id || "").trim();
  if (!tranId || !valId) throw new GatewayRequestError(400, "Missing gateway validation identifiers");
  const ssl = clientFor(environment);
  const validation = await ssl.validateTransaction(valId);
  if (String(validation.status || "").toUpperCase() === "INVALID_TRANSACTION") {
    throw new GatewayRequestError(409, "SSLCOMMERZ validation id is invalid");
  }
  return settleValidatedAttempt({ tranId, validation });
}

export async function initiateSslPayment(req, res, environment = process.env, deps = {}) {
  const noticeId = req.body?.noticeId;
  if (!isPositiveInteger(noticeId)) return res.status(400).json({ error: "Invalid notice ID" });
  const config = sslcommerzConfig(environment);
  if (!config.configured) {
    return res.status(503).json({ error: "SSLCOMMERZ is not configured" });
  }
  const urls = callbackUrls(config.callbackBase);
  const runTransaction = deps.runTransaction || withTransaction;
  const ssl = deps.sslClient || clientFor(environment);

  try {
    const started = await runTransaction(async (connection) => {
      const notice = await connection.execute(
        `${NOTICE_OWNER_SQL} FOR UPDATE`,
        { noticeId: Number(noticeId), ownerId: req.user.ownerId }
      );
      if (!notice.rows?.length) throw new GatewayRequestError(404, "Notice not found");
      const reserved = await reserveInitiatedGatewayAttempt(connection, {
        noticeId: Number(noticeId),
        ownerId: req.user.ownerId,
        fineAmount: notice.rows[0].fineAmount
      });
      const profile = await ownerProfile(connection, req.user.ownerId);
      return {
        ...reserved,
        fineAmount: notice.rows[0].fineAmount,
        profile,
        noticeId: Number(noticeId)
      };
    });

    let session;
    try {
      session = await ssl.initiateSession({
        store_id: config.storeId,
        store_passwd: config.storePassword,
        total_amount: Number(started.fineAmount).toFixed(2),
        currency: "BDT",
        tran_id: started.tranId,
        product_category: "traffic-fine",
        success_url: urls.success,
        fail_url: urls.fail,
        cancel_url: urls.cancel,
        ipn_url: urls.ipn,
        cus_name: started.profile.name,
        cus_email: started.profile.email,
        cus_add1: started.profile.address,
        cus_city: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: started.profile.phone,
        shipping_method: "NO",
        product_name: `Traffic notice ${started.noticeId}`,
        product_profile: "non-physical-goods",
        value_a: String(started.noticeId),
        value_b: String(req.user.ownerId)
      });
    } catch (error) {
      await persistGatewayAttemptStatus(started.tranId, "Failed", runTransaction);
      throw error;
    }

    const gatewayPageUrl = session.GatewayPageURL;
    if (String(session.status || "").toUpperCase() !== "SUCCESS" || !isSafeGatewayPageUrl(gatewayPageUrl, config.isLive)) {
      await persistGatewayAttemptStatus(started.tranId, "Failed", runTransaction);
      return res.status(502).json({ error: "SSLCOMMERZ did not return a sandbox gateway URL" });
    }

    await persistGatewaySessionKey(started.tranId, session.sessionkey || null, runTransaction);

    return res.status(201).json({
      noticeId: started.noticeId,
      amount: started.fineAmount,
      tranId: started.tranId,
      gatewayPageUrl
    });
  } catch (error) {
    if (error instanceof GatewayRequestError) return res.status(error.status).json({ error: error.message });
    if (Number(error.errorNum) === 1) return res.status(409).json({ error: "A payment already exists for this notice" });
    return reportDatabaseError(res, "Failed to initiate SSLCOMMERZ payment", error);
  }
}

function redirectToNotices(res, environment, outcome) {
  return res.redirect(302, frontendNoticesUrl(environment, outcome));
}

export async function sslSuccess(req, res, environment = process.env) {
  try {
    await processValidatedCallback(environment, gatewayFields(req));
    return redirectToNotices(res, environment, "success");
  } catch (error) {
    if (error instanceof GatewayRequestError && error.status === 409 && /already|paid/i.test(error.message)) {
      return redirectToNotices(res, environment, "success");
    }
    return redirectToNotices(res, environment, "invalid");
  }
}

export async function sslFail(req, res, environment = process.env) {
  await persistGatewayAttemptStatus(String(gatewayFields(req).tran_id || "").trim(), "Failed");
  return redirectToNotices(res, environment, "fail");
}

export async function sslCancel(req, res, environment = process.env) {
  await persistGatewayAttemptStatus(String(gatewayFields(req).tran_id || "").trim(), "Cancelled");
  return redirectToNotices(res, environment, "cancel");
}

export async function sslIpn(req, res, environment = process.env) {
  const fields = gatewayFields(req);
  const status = String(fields.status || "").toUpperCase();
  try {
    if (status === "FAILED") {
      await persistGatewayAttemptStatus(String(fields.tran_id || "").trim(), "Failed");
      return res.status(200).send("IPN_FAILED");
    }
    if (status === "CANCELLED" || status === "UNATTEMPTED" || status === "EXPIRED") {
      await persistGatewayAttemptStatus(String(fields.tran_id || "").trim(), "Cancelled");
      return res.status(200).send("IPN_CANCELLED");
    }
    await processValidatedCallback(environment, fields);
    return res.status(200).send("IPN_RECEIVED");
  } catch (error) {
    if (error instanceof GatewayRequestError && (error.status === 409 || error.status === 404)) {
      return res.status(200).send("IPN_IGNORED");
    }
    return res.status(200).send("IPN_ERROR");
  }
}

export function bindSslHandlers(environment = process.env) {
  return {
    initiate: (req, res) => initiateSslPayment(req, res, environment),
    success: (req, res) => sslSuccess(req, res, environment),
    fail: (req, res) => sslFail(req, res, environment),
    cancel: (req, res) => sslCancel(req, res, environment),
    ipn: (req, res) => sslIpn(req, res, environment)
  };
}
