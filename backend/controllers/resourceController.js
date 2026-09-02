import { execute } from "../config/database.js";
import { parseLimit, reportDatabaseError } from "../utils/http.js";

export const RESOURCE_QUERIES = Object.freeze({
  cameras: `
    SELECT
      c.ID AS "cameraId",
      CASE c.Status
        WHEN 'Active' THEN 'online'
        WHEN 'Under Maintenance' THEN 'degraded'
        ELSE 'offline'
      END AS "status",
      c.Road_segment_id AS "roadSegmentId",
      rs.Zone_id AS "zoneId"
    FROM CAMERA c
    JOIN ROAD_SEGMENT rs ON rs.ID = c.Road_segment_id
    ORDER BY c.ID`,
  zones: `
    SELECT
      ID AS "zoneId",
      Name AS "name",
      Area AS "area"
    FROM ZONE
    ORDER BY ID`,
  roadSegments: `
    SELECT
      ID AS "roadSegmentId",
      Name AS "name",
      Start_point AS "startPoint",
      End_point AS "endPoint",
      Speed_limit AS "speedLimit",
      Lane AS "laneCount",
      Zone_id AS "zoneId"
    FROM ROAD_SEGMENT
    ORDER BY ID`,
  users: `
    SELECT
      ua.ID AS "userId",
      ua.First_name AS "firstName",
      ua.Last_name AS "lastName",
      ua.Email AS "email",
      CASE
        WHEN EXISTS (SELECT 1 FROM ADMIN a WHERE a.ID = ua.ID) THEN 'Admin'
        WHEN EXISTS (SELECT 1 FROM TRAFFIC_OFFICER t WHERE t.ID = ua.ID) THEN 'Traffic Officer'
        WHEN EXISTS (SELECT 1 FROM DMP_OFFICER d WHERE d.ID = ua.ID) THEN 'DMP Officer'
        WHEN EXISTS (SELECT 1 FROM VEHICLE_OWNER vo WHERE vo.ID = ua.ID) THEN 'Vehicle Owner'
        ELSE 'User'
      END AS "role",
      COALESCE(
        (SELECT a.Designation FROM ADMIN a WHERE a.ID = ua.ID),
        (SELECT t.Rank FROM TRAFFIC_OFFICER t WHERE t.ID = ua.ID)
      ) AS "designation",
      (SELECT t.Assigned_zone FROM TRAFFIC_OFFICER t WHERE t.ID = ua.ID) AS "zoneId",
      'active' AS "status"
    FROM "USER" ua
    ORDER BY ua.ID`,
  cameraEvents: `
    SELECT
      ce.ID AS "cameraEventId",
      ce.Camera_id AS "cameraId",
      COALESCE(
        (SELECT MIN(v.Licence_plate_no)
         FROM INVOLVED_IN ii
         JOIN VEHICLE v ON v.ID = ii.Vehicle_id
         WHERE ii.Violation_event_id = ce.ID),
        (SELECT MIN(v.Licence_plate_no)
         FROM IDENTIFIED_IN idi
         JOIN VEHICLE v ON v.ID = idi.Vehicle_id
         WHERE idi.Suspicious_event_id = ce.ID)
      ) AS "vehicleId",
      CASE
        WHEN EXISTS (SELECT 1 FROM VIOLATION_EVENT ve WHERE ve.ID = ce.ID) THEN 'violation'
        WHEN EXISTS (SELECT 1 FROM SUSPICIOUS_VEHICLE_EVENT se WHERE se.ID = ce.ID) THEN 'suspicious'
        WHEN EXISTS (SELECT 1 FROM CONGESTION_EVENT co WHERE co.ID = ce.ID) THEN 'congestion'
        WHEN EXISTS (SELECT 1 FROM ROAD_DEFECT_EVENT rd WHERE rd.ID = ce.ID) THEN 'road-defect'
        ELSE 'alert'
      END AS "eventType",
      ce.Event_time AS "capturedAt",
      ce.Confidence_score AS "confidenceScore"
    FROM CAMERA_EVENT ce
    ORDER BY ce.Event_time DESC`,
  violationEvents: `
    SELECT
      ve.ID AS "violationEventId",
      ve.ID AS "cameraEventId",
      v.Licence_plate_no AS "vehicleId",
      ve.Type AS "type",
      rs.Speed_limit AS "speedLimit",
      ve.Lane_number AS "laneNumber",
      ce.Confidence_score AS "confidenceScore",
      CASE
        WHEN ve.Action_taken IS NULL THEN 'pending-review'
        WHEN UPPER(ve.Action_taken) = 'REJECTED' THEN 'rejected'
        ELSE 'confirmed'
      END AS "status"
    FROM VIOLATION_EVENT ve
    JOIN CAMERA_EVENT ce ON ce.ID = ve.ID
    JOIN CAMERA c ON c.ID = ce.Camera_id
    JOIN ROAD_SEGMENT rs ON rs.ID = c.Road_segment_id
    LEFT JOIN INVOLVED_IN ii ON ii.Violation_event_id = ve.ID
    LEFT JOIN VEHICLE v ON v.ID = ii.Vehicle_id
    ORDER BY ce.Event_time DESC`,
  evidence: `
    SELECT
      Camera_event_id AS "cameraEventId",
      Evidence_number AS "evidenceNo",
      Captured_image_path AS "capturedImagePath",
      Captured_video_path AS "capturedVideoPath"
    FROM EVIDENCE
    ORDER BY Camera_event_id, Evidence_number`,
  alertEvents: `
    SELECT
      ae.ID AS "alertEventId",
      ae.Type AS "name",
      ae.Type AS "type",
      rs.ID AS "roadSegmentId",
      ce.Event_time AS "time",
      CASE WHEN ae.Action_taken IS NULL THEN 'open' ELSE 'resolved' END AS "status",
      CASE WHEN ae.Type IN ('Accident', 'Fire') THEN 'danger' ELSE 'warning' END AS "severity"
    FROM ALERT_EVENT ae
    JOIN CAMERA_EVENT ce ON ce.ID = ae.ID
    JOIN CAMERA c ON c.ID = ce.Camera_id
    JOIN ROAD_SEGMENT rs ON rs.ID = c.Road_segment_id
    ORDER BY ce.Event_time DESC`,
  roadDefectEvents: `
    SELECT
      rd.ID AS "roadDefectEventId",
      rd.Type AS "type",
      rs.ID AS "roadSegmentId",
      ce.Event_time AS "reportedAt",
      CASE WHEN rd.Decision IS NULL THEN 'open' ELSE LOWER(rd.Decision) END AS "status",
      'warning' AS "severity"
    FROM ROAD_DEFECT_EVENT rd
    JOIN CAMERA_EVENT ce ON ce.ID = rd.ID
    JOIN CAMERA c ON c.ID = ce.Camera_id
    JOIN ROAD_SEGMENT rs ON rs.ID = c.Road_segment_id
    ORDER BY ce.Event_time DESC`,
  suspiciousVehicleEvents: `
    SELECT
      sve.ID AS "suspiciousVehicleEventId",
      sve.Type AS "type",
      v.Licence_plate_no AS "vehicleId",
      ce.Camera_id AS "cameraId",
      ce.Event_time AS "detectedAt",
      'danger' AS "severity"
    FROM SUSPICIOUS_VEHICLE_EVENT sve
    JOIN CAMERA_EVENT ce ON ce.ID = sve.ID
    LEFT JOIN IDENTIFIED_IN ii ON ii.Suspicious_event_id = sve.ID
    LEFT JOIN VEHICLE v ON v.ID = ii.Vehicle_id
    ORDER BY ce.Event_time DESC`,
  riskAnalysis: `
    SELECT
      ID AS "riskAnalysisId",
      Road_segment_id AS "roadSegmentId",
      Analysis_date AS "analysisDate",
      Risk_level AS "riskLevel"
    FROM RISK_ANALYSIS
    ORDER BY Analysis_date DESC, ID`,
  vehicleJourney: `
    SELECT
      vj.ID AS "journeyId",
      v.Licence_plate_no AS "vehicleId",
      vj.Camera_id AS "cameraId",
      vj.Start_time_per_interval AS "startTime",
      vj.End_time_per_interval AS "endTime",
      vj.Distance_travelled AS "distanceTravelled",
      vj.Interval_number AS "intervalNumber",
      vj.Interval_location AS "intervalLocation"
    FROM VEHICLE_JOURNEY vj
    JOIN VEHICLE v ON v.ID = vj.Vehicle_id
    ORDER BY vj.Start_time_per_interval DESC`,
  congestionEvents: `
    SELECT
      co.ID AS "congestionEventId",
      ce.Camera_id AS "cameraId",
      c.Road_segment_id AS "roadSegmentId",
      LOWER(co.Severity) AS "severity",
      co.Vehicle_count AS "vehicleCount",
      co.Time AS "duration",
      ce.Event_time AS "capturedAt"
    FROM CONGESTION_EVENT co
    JOIN CAMERA_EVENT ce ON ce.ID = co.ID
    JOIN CAMERA c ON c.ID = ce.Camera_id
    ORDER BY ce.Event_time DESC`
});

export function listResource(resourceName) {
  return async (req, res) => {
    const query = RESOURCE_QUERIES[resourceName];
    if (!query) return res.status(404).json({ error: "Resource not found" });
    try {
      const limit = parseLimit(req.query.limit);
      const result = await execute(`SELECT * FROM (${query}) WHERE ROWNUM <= :limit`, { limit });
      return res.json(result.rows || []);
    } catch (error) {
      return reportDatabaseError(res, `Failed to fetch ${resourceName}`, error);
    }
  };
}
