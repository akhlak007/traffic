import { execute, withTransaction } from "../config/database.js";
import oracledb from "oracledb";
import { isPositiveInteger, reportDatabaseError } from "../utils/http.js";
import { paymentBlockReason } from "../utils/noticeEligibility.js";

class PaymentRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function createPayment(req, res) {
  const noticeId = req.body?.noticeId;
  const method = String(req.body?.method || "").trim().toLowerCase();
  const provider = String(req.body?.provider || "").trim();
  const reference = String(req.body?.reference || "").trim();

  if (!isPositiveInteger(noticeId)) return res.status(400).json({ error: "Invalid notice ID" });
  if (!new Set(["bank", "mfs"]).has(method)) return res.status(400).json({ error: "Payment method must be bank or mfs" });
  if (provider.length < 2 || provider.length > 50) return res.status(400).json({ error: "Provider must be between 2 and 50 characters" });
  if (!/^[A-Za-z0-9-]{6,50}$/.test(reference)) {
    return res.status(400).json({ error: "Reference must be 6-50 letters, numbers, or hyphens" });
  }

  try {
    const payment = await withTransaction(async (connection) => {
      const notice = await connection.execute(`
        SELECT n.ID AS "noticeId", n.Fine_amount AS "fineAmount"
        FROM NOTICE n
        JOIN INVOLVED_IN ii ON ii.Violation_event_id = n.Violation_event_id
        JOIN VEHICLE v ON v.ID = ii.Vehicle_id
        WHERE n.ID = :noticeId AND v.Vehicle_owner_id = :ownerId
          AND (SELECT COUNT(*) FROM INVOLVED_IN own_ii WHERE own_ii.Violation_event_id = n.Violation_event_id) = 1
        FOR UPDATE`,
      { noticeId: Number(noticeId), ownerId: req.user.ownerId });
      if (!notice.rows?.length) throw new PaymentRequestError(404, "Notice not found");
      const blocked = await paymentBlockReason(connection, Number(noticeId));
      if (blocked) throw new PaymentRequestError(409, blocked);

      const fineAmount = notice.rows[0].fineAmount;
      const insert = await connection.execute(`
        INSERT INTO PAYMENT (Payment_date, Status, Amount)
        VALUES (SYSDATE, 'Successful', :amount)
        RETURNING ID INTO :paymentId`,
      {
        amount: fineAmount,
        paymentId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      });
      const paymentId = insert.outBinds.paymentId[0];
      await connection.execute(`
        INSERT INTO PAYS (Payment_id, Vehicle_owner_id, Notice_id)
        VALUES (:paymentId, :ownerId, :noticeId)`,
      { paymentId, ownerId: req.user.ownerId, noticeId: Number(noticeId) });

      if (method === "bank") {
        await connection.execute(`
          INSERT INTO BY_BANK (ID, Branch_name, Receipt_no)
          VALUES (:paymentId, :provider, :reference)`,
        { paymentId, provider, reference });
      } else {
        await connection.execute(`
          INSERT INTO BY_MFS (ID, Ref_no, Name, Transaction_id)
          VALUES (:paymentId, :reference, :provider, :transactionId)`,
        { paymentId, reference, provider, transactionId: `MFS-${paymentId}` });
      }

      return { paymentId, noticeId: Number(noticeId), amount: fineAmount, status: "successful", method };
    });
    return res.status(201).json(payment);
  } catch (error) {
    if (error instanceof PaymentRequestError) return res.status(error.status).json({ error: error.message });
    if (Number(error.errorNum) === 1) return res.status(409).json({ error: "A payment already exists for this notice" });
    return reportDatabaseError(res, "Failed to create payment request", error);
  }
}

export async function getPayments(req, res) {
  try {
    const result = await execute(`SELECT p.ID AS "paymentId", py.Notice_id AS "noticeId",
      p.Payment_date AS "paymentDate", LOWER(p.Status) AS "status", p.Amount AS "amount",
      CASE WHEN b.ID IS NOT NULL THEN 'bank' ELSE 'mfs' END AS "method",
      COALESCE(b.Receipt_no, m.Ref_no) AS "reference"
      FROM PAYMENT p JOIN PAYS py ON py.Payment_id=p.ID
      LEFT JOIN BY_BANK b ON b.ID=p.ID LEFT JOIN BY_MFS m ON m.ID=p.ID
      WHERE py.Vehicle_owner_id=:ownerId ORDER BY p.Payment_date DESC, p.ID DESC`, { ownerId: req.user.ownerId });
    return res.json(result.rows || []);
  } catch (error) { return reportDatabaseError(res, "Failed to fetch payment history", error); }
}
