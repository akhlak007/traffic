import oracledb from "oracledb";
import { execute } from "../config/database.js";
import { isPositiveInteger, parseLimit, reportDatabaseError } from "../utils/http.js";
import { presentNoticeRow } from "../../js/noticeState.js";

const NOTICE_SELECT = `
  SELECT
    n.ID AS "noticeId",
    n.Violation_event_id AS "violationEventId",
    v.Licence_plate_no AS "vehicleId",
    v.Licence_plate_no AS "licensePlate",
    v.Vehicle_owner_id AS "ownerId",
    n.Fine_amount AS "fineAmount",
    n.Issue_date AS "issueDate",
    n.Due_date AS "dueDate",
    v.Type AS "vehicleType",
    ve.Type AS "violationType",
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status = 'Successful'
      ) THEN 'paid'
      WHEN EXISTS (
        SELECT 1 FROM APPEAL a
        WHERE a.Notice_id = n.ID AND a.Review_status = 'Approved'
      ) THEN 'dismissed'
      WHEN EXISTS (
        SELECT 1 FROM APPEAL a
        WHERE a.Notice_id = n.ID AND a.Review_status IN ('Pending', 'Under Review')
      ) THEN 'appealed'
      WHEN EXISTS (
        SELECT 1 FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status = 'Pending'
      ) THEN 'payment-pending'
      WHEN EXISTS (
        SELECT 1 FROM APPEAL a
        WHERE a.Notice_id = n.ID AND a.Review_status = 'Rejected'
      ) THEN 'appeal-rejected'
      WHEN n.Due_date < SYSDATE THEN 'overdue'
      ELSE 'pending'
    END AS "status",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status = 'Successful'
      ) THEN 'Successful'
      WHEN EXISTS (
        SELECT 1 FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status = 'Pending'
      ) THEN 'Pending'
      ELSE NULL
    END AS "paymentStatus",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status IN ('Pending', 'Successful')
      ) THEN 0
      WHEN EXISTS (
        SELECT 1 FROM APPEAL a
        WHERE a.Notice_id = n.ID AND a.Review_status IN ('Pending', 'Under Review', 'Approved')
      ) THEN 0
      ELSE 1
    END AS "canPay",
    CASE
      WHEN EXISTS (
        SELECT 1 FROM PAYS p
        JOIN PAYMENT payment ON payment.ID = p.Payment_id
        WHERE p.Notice_id = n.ID AND payment.Status IN ('Pending', 'Successful')
      ) THEN 0
      WHEN EXISTS (SELECT 1 FROM APPEAL a WHERE a.Notice_id = n.ID) THEN 0
      ELSE 1
    END AS "canAppeal"
  FROM NOTICE n
  JOIN VIOLATION_EVENT ve ON ve.ID = n.Violation_event_id
  JOIN INVOLVED_IN ii ON n.Violation_event_id = ii.Violation_event_id
  JOIN VEHICLE v ON v.ID = ii.Vehicle_id`;

export async function getNotices(req, res) {
  try {
    const ownerOnly = req.user.role === "owner";
    const limit = parseLimit(req.query.limit);
    const ownerWhere = ownerOnly ? `WHERE v.Vehicle_owner_id = :ownerId AND (SELECT COUNT(*) FROM INVOLVED_IN own_ii WHERE own_ii.Violation_event_id=n.Violation_event_id)=1` : "";
    const sql = `SELECT * FROM (${NOTICE_SELECT} ${ownerWhere} ORDER BY n.Issue_date DESC) WHERE ROWNUM <= :limit`;
    const binds = ownerOnly ? { ownerId: req.user.ownerId, limit } : { limit };
    const result = await execute(sql, binds);
    return res.json((result.rows || []).map(presentNoticeRow));
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch notices", error);
  }
}

export async function getNoticeById(req, res) {
  const { noticeId } = req.params;
  if (!isPositiveInteger(noticeId)) return res.status(400).json({ error: "Invalid notice ID" });

  try {
    const ownerOnly = req.user.role === "owner";
    const ownerWhere = ownerOnly ? `AND v.Vehicle_owner_id = :ownerId AND (SELECT COUNT(*) FROM INVOLVED_IN own_ii WHERE own_ii.Violation_event_id=n.Violation_event_id)=1` : "";
    const sql = `${NOTICE_SELECT} WHERE n.ID = :noticeId ${ownerWhere}`;
    const binds = ownerOnly
      ? { noticeId: Number(noticeId), ownerId: req.user.ownerId }
      : { noticeId: Number(noticeId) };
    const result = await execute(sql, binds);
    if (!result.rows?.length) return res.status(404).json({ error: "Notice not found" });
    return res.json(presentNoticeRow(result.rows[0]));
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch notice", error);
  }
}

export async function createNotice(req, res) {
  const violationEventId = req.body?.violationEventId;
  const dueDate = String(req.body?.dueDate || "").trim();
  const fineAmount = Number(req.body?.fineAmount);
  const parsedDueDate = new Date(`${dueDate}T23:59:59`);
  if (!isPositiveInteger(violationEventId) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(parsedDueDate.getTime()) || parsedDueDate < new Date() || !Number.isFinite(fineAmount) || fineAmount <= 0) {
    return res.status(400).json({ error: "Valid violation event, due date, and fine amount are required" });
  }
  try {
    const verified = await execute(`SELECT 1 FROM VIOLATION_EVENT
      WHERE ID = :eventId AND Action_taken IS NOT NULL AND UPPER(Action_taken) <> 'REJECTED'`, { eventId: Number(violationEventId) });
    if (!verified.rows?.length) return res.status(409).json({ error: "A notice can be issued only for a confirmed violation" });
    const result = await execute(`INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id)
      VALUES (SYSDATE, TO_DATE(:dueDate || ' 23:59:59', 'YYYY-MM-DD HH24:MI:SS'), :fineAmount, :eventId)
      RETURNING ID, Issue_date INTO :noticeId, :issueDate`, {
      dueDate, fineAmount, eventId: Number(violationEventId),
      noticeId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      issueDate: { dir: oracledb.BIND_OUT, type: oracledb.DATE }
    }, { autoCommit: true });
    return res.status(201).json({ noticeId: result.outBinds.noticeId[0], violationEventId: Number(violationEventId), issueDate: result.outBinds.issueDate[0], dueDate, fineAmount });
  } catch (error) {
    if (Number(error.errorNum) === 1) return res.status(409).json({ error: "A notice already exists for this violation" });
    return reportDatabaseError(res, "Failed to issue notice", error);
  }
}
