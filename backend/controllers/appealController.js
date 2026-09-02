import { execute, withTransaction } from "../config/database.js";
import oracledb from "oracledb";
import { isPositiveInteger, parseLimit, reportDatabaseError } from "../utils/http.js";
import { appealBlockReason } from "../utils/noticeEligibility.js";

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const APPEAL_SELECT = `
  SELECT
    a.ID AS "appealId",
    LOWER(a.Review_status) AS "status",
    LOWER(a.Review_status) AS "reviewStatus",
    a.Reason AS "reason",
    a.Reason AS "justification",
    a.Appeal_date AS "applicationDate",
    a.Vehicle_owner_id AS "ownerId",
    a.Notice_id AS "noticeId",
    v.Licence_plate_no AS "licensePlate",
    n.Fine_amount AS "fineAmount",
    LOWER(a.Decision) AS "reviewDecision",
    a.Review_date AS "reviewDate",
    a.Remarks AS "remarks",
    TRIM(u.First_name || ' ' || u.Last_name) AS "ownerName"
  FROM APPEAL a
  JOIN NOTICE n ON a.Notice_id = n.ID
  JOIN INVOLVED_IN ii ON n.Violation_event_id = ii.Violation_event_id
  JOIN VEHICLE v ON v.ID = ii.Vehicle_id
  JOIN VEHICLE_OWNER vo ON vo.ID = a.Vehicle_owner_id
  JOIN "USER" u ON u.ID = vo.ID`;

export async function getAppeals(req, res) {
  try {
    const ownerOnly = req.user.role === "owner";
    const limit = parseLimit(req.query.limit);
    const ownerWhere = ownerOnly ? `WHERE a.Vehicle_owner_id = :ownerId AND v.Vehicle_owner_id = a.Vehicle_owner_id` : "";
    const sql = `SELECT * FROM (${APPEAL_SELECT} ${ownerWhere} ORDER BY a.Appeal_date DESC) WHERE ROWNUM <= :limit`;
    const binds = ownerOnly ? { ownerId: req.user.ownerId, limit } : { limit };
    const result = await execute(sql, binds);
    return res.json(result.rows || []);
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch appeals", error);
  }
}

export async function createAppeal(req, res) {
  const noticeId = req.body?.noticeId;
  const reason = String(req.body?.reason || "").trim();
  if (!isPositiveInteger(noticeId)) return res.status(400).json({ error: "Invalid notice ID" });
  if (reason.length < 10 || reason.length > 300) {
    return res.status(400).json({ error: "Reason must be between 10 and 300 characters" });
  }

  try {
    const appeal = await withTransaction(async (connection) => {
      const notice = await connection.execute(`
        SELECT n.ID AS "noticeId"
        FROM NOTICE n
        JOIN INVOLVED_IN ii ON ii.Violation_event_id = n.Violation_event_id
        JOIN VEHICLE v ON v.ID = ii.Vehicle_id
        WHERE n.ID = :noticeId AND v.Vehicle_owner_id = :ownerId
          AND (SELECT COUNT(*) FROM INVOLVED_IN own_ii WHERE own_ii.Violation_event_id = n.Violation_event_id) = 1`,
      { noticeId: Number(noticeId), ownerId: req.user.ownerId });
      if (!notice.rows?.length) throw new RequestError(404, "Notice not found");
      const blocked = await appealBlockReason(connection, Number(noticeId));
      if (blocked) throw new RequestError(409, blocked);

      const insert = await connection.execute(`
        INSERT INTO APPEAL
          (Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id)
        VALUES
          ('Pending', :reason, SYSDATE, :ownerId, :noticeId)
        RETURNING ID INTO :appealId`,
      {
        reason,
        ownerId: req.user.ownerId,
        noticeId: Number(noticeId),
        appealId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      });
      const appealId = insert.outBinds.appealId[0];
      return { appealId, noticeId: Number(noticeId), reason, reviewStatus: "pending" };
    });
    return res.status(201).json(appeal);
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message });
    return reportDatabaseError(res, "Failed to create appeal", error);
  }
}

export async function reviewAppeal(req, res) {
  const { appealId } = req.params;
  const decision = String(req.body?.decision || "").trim().toLowerCase();
  const remarks = String(req.body?.remarks || "").trim();
  const statusByDecision = { approve: "Approved", approved: "Approved", dismiss: "Approved", reject: "Rejected", rejected: "Rejected", uphold: "Rejected" };
  const reviewStatus = statusByDecision[decision];

  if (!isPositiveInteger(appealId)) return res.status(400).json({ error: "Invalid appeal ID" });
  if (!reviewStatus) return res.status(400).json({ error: "Decision must approve/dismiss or reject/uphold the appeal" });
  if (remarks.length < 5 || remarks.length > 300) return res.status(400).json({ error: "Remarks must be between 5 and 300 characters" });

  try {
    await withTransaction(async (connection) => {
      const update = await connection.execute(
        `UPDATE APPEAL
         SET Review_status = :status,
             Decision = :decision,
             Remarks = :remarks,
             Review_date = SYSDATE
         WHERE ID = :appealId
           AND Review_status IN ('Pending', 'Under Review')`,
        { status: reviewStatus, decision: reviewStatus, remarks, appealId: Number(appealId) }
      );
      if (!update.rowsAffected) {
        const existing = await connection.execute(`SELECT 1 FROM APPEAL WHERE ID=:appealId`, { appealId: Number(appealId) });
        throw new RequestError(existing.rows?.length ? 409 : 404, existing.rows?.length ? "Appeal has already been finalized" : "Appeal not found");
      }
    });
    return res.json({ appealId: Number(appealId), reviewStatus: reviewStatus.toLowerCase() });
  } catch (error) {
    if (error instanceof RequestError) return res.status(error.status).json({ error: error.message });
    return reportDatabaseError(res, "Failed to review appeal", error);
  }
}
