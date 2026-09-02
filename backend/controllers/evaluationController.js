import oracledb from "oracledb";
import { execute, withTransaction } from "../config/database.js";
import { isPositiveInteger, reportDatabaseError } from "../utils/http.js";

function oracleApplicationError(error) {
  const code = Number(error?.errorNum || /ORA-(\d+)/.exec(error?.message || "")?.[1]);
  return {
    20001: [404, "Vehicle not found"],
    20011: [404, "Violation event not found"],
    20012: [404, "Traffic officer not found"],
    20013: [400, "Decision must be Confirmed or Rejected"],
    20014: [409, "Violation event has already been verified"]
  }[code];
}

export async function getCamerasAboveAverage(req, res) {
  try {
    const result = await execute(`
      SELECT Camera_id AS "cameraId",
             COUNT(*) AS "eventCount",
             ROUND((
               SELECT AVG(Event_count)
               FROM (
                 SELECT COUNT(*) AS Event_count
                 FROM CAMERA_EVENT
                 GROUP BY Camera_id
               )
             ), 2) AS "averageEventCount"
      FROM CAMERA_EVENT
      GROUP BY Camera_id
      HAVING COUNT(*) > (
          SELECT AVG(Event_count)
          FROM (
              SELECT COUNT(*) AS Event_count
              FROM CAMERA_EVENT
              GROUP BY Camera_id
          )
      )
      ORDER BY COUNT(*) DESC, Camera_id`);
    return res.json(result.rows || []);
  } catch (error) {
    return reportDatabaseError(res, "Failed to run camera event subquery report", error);
  }
}

export async function getVehicleViolations(req, res) {
  try {
    const plate = String(req.params.plate || "").trim().toUpperCase();
    const result = await execute(`
      SELECT Licence_plate_no AS "licensePlate", Vehicle_owner_id AS "ownerId",
             Owner_name AS "ownerName", Violation_event_id AS "violationEventId",
             Violation_type AS "violationType", Event_date AS "eventDate",
             Notice_id AS "noticeId", Fine_amount AS "fineAmount"
      FROM VEHICLE_VIOLATION_VIEW
      WHERE Licence_plate_no = :plate
      ORDER BY Event_date DESC, Violation_event_id DESC`, { plate });
    const rows = (result.rows || []).map((row) => ({
      ...row,
      noticeStatus: row.noticeId == null ? "not-issued" : "issued"
    }));
    return res.json(rows);
  } catch (error) {
    return reportDatabaseError(res, "Failed to query vehicle violation view", error);
  }
}

export async function getVehicleProfile(req, res) {
  try {
    const plate = String(req.params.plate || "").trim().toUpperCase();
    const result = await execute(`
      SELECT r.Report.Licence_plate_no AS "licensePlate",
             r.Report.Owner_name AS "ownerName",
             LOWER(r.Report.Fitness_status) AS "fitnessStatus",
             LOWER(r.Report.Legal_status) AS "legalStatus",
             FN_VIOLATION_COUNT(r.Report.Licence_plate_no) AS "violationCount"
      FROM VEHICLE_REPORT r
      WHERE r.Report.Licence_plate_no = :plate`, { plate });
    if (!result.rows?.length) return res.status(404).json({ error: "Vehicle not found" });
    return res.json(result.rows[0]);
  } catch (error) {
    const mapped = oracleApplicationError(error);
    if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
    return reportDatabaseError(res, "Failed to query vehicle report object", error);
  }
}

export async function getTotalFine(req, res) {
  try {
    const ownerId = Number(req.user.ownerId);
    const result = await execute(
      `DECLARE
    v_fine NOTICE.Fine_amount%TYPE;
BEGIN
    SELECT n.Fine_amount
    INTO v_fine
    FROM NOTICE n, INVOLVED_IN ii, VEHICLE v
    WHERE n.Violation_event_id = ii.Violation_event_id
      AND ii.Vehicle_id = v.ID
      AND v.Vehicle_owner_id = :ownerId;

    :total := v_fine;
    :handled := 'NONE';
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        :total := 0;
        :handled := 'NO_DATA_FOUND';
    WHEN TOO_MANY_ROWS THEN
        SELECT SUM(n.Fine_amount)
        INTO v_fine
        FROM NOTICE n, INVOLVED_IN ii, VEHICLE v
        WHERE n.Violation_event_id = ii.Violation_event_id
          AND ii.Vehicle_id = v.ID
          AND v.Vehicle_owner_id = :ownerId;
        :total := v_fine;
        :handled := 'TOO_MANY_ROWS';
END;`,
      {
        ownerId,
        total: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        handled: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 20 }
      }
    );
    return res.json({
      ownerId,
      totalFine: result.outBinds.total,
      exceptionHandled: result.outBinds.handled
    });
  } catch (error) {
    return reportDatabaseError(res, "Failed to execute owner fine PL/SQL block", error);
  }
}

export async function getPendingAppealSummary(req, res) {
  try {
    const result = await execute(
      `BEGIN GET_PENDING_APPEAL_SUMMARY(:count, :total); END;`,
      {
        count: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        total: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    );
    return res.json({
      pendingAppealCount: result.outBinds.count,
      pendingAppealFineTotal: result.outBinds.total
    });
  } catch (error) {
    return reportDatabaseError(res, "Failed to execute GET_PENDING_APPEAL_SUMMARY", error);
  }
}

export async function getVehicleLookup(req, res) {
  try {
    const plate = String(req.params.plate || "").trim().toUpperCase();
    const result = await execute(
      `DECLARE
    v_plate VEHICLE.Licence_plate_no%TYPE;
BEGIN
    SELECT v.Licence_plate_no
    INTO v_plate
    FROM VEHICLE v
    WHERE v.Licence_plate_no = :plate;

    :found := 'Y';
    :message := 'Vehicle found.';
    :licensePlate := v_plate;

EXCEPTION
    WHEN NO_DATA_FOUND THEN
        :found := 'N';
        :message := 'Vehicle not found.';
        :licensePlate := :plate;
END;`,
      {
        plate,
        found: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 1 },
        message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 80 },
        licensePlate: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 }
      }
    );
    return res.json({
      found: result.outBinds.found === "Y",
      licensePlate: result.outBinds.licensePlate,
      message: result.outBinds.message
    });
  } catch (error) {
    return reportDatabaseError(res, "Failed to execute vehicle lookup PL/SQL block", error);
  }
}

export async function getVehicleFitness(req, res) {
  try {
    const plate = String(req.params.plate || "").trim().toUpperCase();
    const result = await execute(
      `DECLARE
    v_status  VEHICLE.Fitness_status%TYPE;
    v_message VARCHAR2(80);
BEGIN
    SELECT v.Fitness_status
    INTO v_status
    FROM VEHICLE v
    WHERE v.Licence_plate_no = :plate;

    IF v_status = 'Valid' THEN
        v_message := 'Fitness is valid. Vehicle is roadworthy.';
    ELSE
        v_message := 'Fitness has expired. Vehicle is not roadworthy.';
    END IF;

    :fitnessStatus := v_status;
    :message := v_message;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        :fitnessStatus := 'Unknown';
        :message := 'Vehicle not found.';
END;`,
      {
        plate,
        fitnessStatus: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 20 },
        message: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 80 }
      }
    );
    return res.json({
      licensePlate: plate,
      fitnessStatus: result.outBinds.fitnessStatus,
      message: result.outBinds.message
    });
  } catch (error) {
    return reportDatabaseError(res, "Failed to execute vehicle fitness PL/SQL block", error);
  }
}

export async function getPendingAppeals(req, res) {
  try {
    const payload = await withTransaction(async (connection) => {
      const call = await connection.execute(
        `BEGIN PR_GET_PENDING_APPEALS(:count); END;`,
        { count: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }
      );
      const list = await connection.execute(
        `SELECT ID AS "appealId",
                Appeal_date AS "appealDate",
                Review_status AS "reviewStatus"
         FROM PENDING_APPEAL_LIST
         ORDER BY ID`
      );
      return {
        pendingCount: Number(call.outBinds.count || 0),
        appeals: list.rows || []
      };
    });
    return res.json(payload);
  } catch (error) {
    return reportDatabaseError(res, "Failed to execute pending appeal cursor", error);
  }
}

export async function verifyViolation(req, res) {
  const { eventId } = req.params;
  const normalized = String(req.body?.decision || "").trim().toLowerCase();
  const remarks = String(req.body?.remarks || "").trim();
  const decision = { confirm: "Confirmed", confirmed: "Confirmed", reject: "Rejected", rejected: "Rejected" }[normalized];
  if (!isPositiveInteger(eventId)) return res.status(400).json({ error: "Invalid violation event ID" });
  if (!decision) return res.status(400).json({ error: "Decision must be Confirmed or Rejected" });
  if (remarks.length < 5 || remarks.length > 300) return res.status(400).json({ error: "Remarks must be between 5 and 300 characters" });

  try {
    const result = await execute(`
      UPDATE VIOLATION_EVENT
      SET Action_taken = :decision,
          Remarks = :remarks,
          Traffic_officer_id = :officerId,
          Monitor_date = SYSDATE
      WHERE ID = :eventId
        AND Action_taken IS NULL
        AND EXISTS (
          SELECT 1 FROM CAMERA_EVENT ce
          WHERE ce.ID = VIOLATION_EVENT.ID AND ce.Confidence_score < 50
        )`,
    { eventId: Number(eventId), officerId: req.user.userId, decision, remarks },
    { autoCommit: true });
    if (!result.rowsAffected) {
      const existing = await execute(`
        SELECT ve.Action_taken AS "actionTaken", ce.Confidence_score AS "confidenceScore"
        FROM VIOLATION_EVENT ve
        LEFT JOIN CAMERA_EVENT ce ON ce.ID = ve.ID
        WHERE ve.ID = :eventId`, { eventId: Number(eventId) });
      if (!existing.rows?.length) return res.status(404).json({ error: "Violation event not found" });
      if (existing.rows[0].actionTaken) {
        return res.status(409).json({ error: "Violation event has already been verified" });
      }
      if (Number(existing.rows[0].confidenceScore) >= 50) {
        return res.status(409).json({ error: "Only detections with confidence below 50% require officer verification" });
      }
      return res.status(409).json({ error: "Violation event has already been verified" });
    }
    return res.json({ violationEventId: Number(eventId), verificationStatus: decision.toLowerCase(), officerId: req.user.userId });
  } catch (error) {
    const mapped = oracleApplicationError(error);
    if (mapped) return res.status(mapped[0]).json({ error: mapped[1] });
    return reportDatabaseError(res, "Failed to verify violation event", error);
  }
}

function cameraPayload(body, partial = false) {
  const has = (key) => Object.hasOwn(body || {}, key);
  const status = has("status") ? { online: "Active", offline: "Inactive", degraded: "Under Maintenance" }[String(body.status).toLowerCase()] : null;
  const value = {
    status,
    roadSegmentId: has("roadSegmentId") ? Number(body.roadSegmentId) : null,
    model: has("model") ? String(body.model).trim() : null,
    cameraType: has("cameraType") || has("type") ? String(body.cameraType || body.type).trim() : null,
    laneNumber: has("laneNumber") ? Number(body.laneNumber) : null,
    confidence: has("confidence") ? Number(body.confidence) : null
  };
  const valid = value.status && isPositiveInteger(value.roadSegmentId) && value.model && value.cameraType
    && isPositiveInteger(value.laneNumber) && value.confidence >= 0 && value.confidence <= 100;
  const partialValid = Object.keys(body || {}).length && (!has("status") || value.status)
    && (!has("roadSegmentId") || isPositiveInteger(value.roadSegmentId)) && (!has("model") || value.model)
    && (!(has("cameraType") || has("type")) || value.cameraType) && (!has("laneNumber") || isPositiveInteger(value.laneNumber))
    && (!has("confidence") || value.confidence >= 0 && value.confidence <= 100);
  return partial ? partialValid ? value : null : valid ? value : null;
}

export async function createCamera(req, res) {
  const value = cameraPayload(req.body);
  if (!value) return res.status(400).json({ error: "Valid status, road segment, model, type, lane, and confidence are required" });
  try {
    const result = await execute(`
      INSERT INTO CAMERA (Status, Road_segment_id, Model, Camera_type, Lane_number, Confidence_score)
      VALUES (:status, :roadSegmentId, :model, :cameraType, :laneNumber, :confidence)
      RETURNING Camera_id INTO :cameraId`, {
      ...value, cameraId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    }, { autoCommit: true });
    return res.status(201).json({ cameraId: result.outBinds.cameraId[0], roadSegmentId: value.roadSegmentId, model: value.model, type: value.cameraType, laneNumber: value.laneNumber, confidence: value.confidence, status: String(req.body.status).toLowerCase() });
  } catch (error) { return reportDatabaseError(res, "Failed to create camera", error); }
}

export async function updateCamera(req, res) {
  if (!isPositiveInteger(req.params.cameraId)) return res.status(400).json({ error: "Invalid camera ID" });
  const value = cameraPayload(req.body, true);
  if (!value) return res.status(400).json({ error: "At least one valid camera field is required" });
  try {
    const result = await execute(`UPDATE CAMERA SET Status=COALESCE(:status,Status), Road_segment_id=COALESCE(:roadSegmentId,Road_segment_id),
      Model=COALESCE(:model,Model), Camera_type=COALESCE(:cameraType,Camera_type), Lane_number=COALESCE(:laneNumber,Lane_number), Confidence_score=COALESCE(:confidence,Confidence_score)
      WHERE Camera_id=:cameraId`, { ...value, cameraId: Number(req.params.cameraId) }, { autoCommit: true });
    if (!result.rowsAffected) return res.status(404).json({ error: "Camera not found" });
    return res.json({ cameraId: Number(req.params.cameraId), updated: true });
  } catch (error) { return reportDatabaseError(res, "Failed to update camera", error); }
}

export async function createZone(req, res) {
  const name = String(req.body?.name || "").trim(); const area = String(req.body?.area || "").trim();
  const status = String(req.body?.status || "").toLowerCase();
  if (!name || !area || !["safe", "warning", "danger"].includes(status)) return res.status(400).json({ error: "Name, area, and valid status are required" });
  try {
    const result = await execute(`INSERT INTO ZONE (Name, Area, Status) VALUES (:name,:area,:status) RETURNING Zone_id INTO :zoneId`,
      { name, area, status, zoneId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER } }, { autoCommit: true });
    return res.status(201).json({ zoneId: result.outBinds.zoneId[0], name, area, status });
  } catch (error) { return reportDatabaseError(res, "Failed to create zone", error); }
}

export async function updateZone(req, res) {
  if (!isPositiveInteger(req.params.zoneId)) return res.status(400).json({ error: "Invalid zone ID" });
  const has = (key) => Object.hasOwn(req.body || {}, key);
  const name = has("name") ? String(req.body.name).trim() : null; const area = has("area") ? String(req.body.area).trim() : null;
  const status = has("status") ? String(req.body.status).toLowerCase() : null;
  if (!Object.keys(req.body || {}).length || (has("name") && !name) || (has("area") && !area) || (has("status") && !["safe", "warning", "danger"].includes(status))) return res.status(400).json({ error: "At least one valid zone field is required" });
  try {
    const result = await execute(`UPDATE ZONE SET Name=COALESCE(:name,Name), Area=COALESCE(:area,Area), Status=COALESCE(:status,Status) WHERE Zone_id=:zoneId`,
      { name, area, status, zoneId: Number(req.params.zoneId) }, { autoCommit: true });
    if (!result.rowsAffected) return res.status(404).json({ error: "Zone not found" });
    return res.json({ zoneId: Number(req.params.zoneId), updated: true });
  } catch (error) { return reportDatabaseError(res, "Failed to update zone", error); }
}
