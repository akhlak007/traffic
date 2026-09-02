-- CSE-302 faculty demo inspection queries
-- Run as SMART_TRAFFIC in SQL Developer. Read-only. Safe to re-run.
-- Seeded owners: Zubaer 17, Fahim 18, Swagata 19, Tanisha 20, Akhlak 21.

SELECT * FROM "USER" ORDER BY ID;

SELECT * FROM "USER" ORDER BY ID DESC;

SELECT * FROM VEHICLE_OWNER ORDER BY ID;

SELECT * FROM VEHICLE ORDER BY ID;

SELECT * FROM NOTICE ORDER BY ID;

SELECT * FROM NOTICE ORDER BY ID DESC;

SELECT * FROM PAYMENT ORDER BY ID;

SELECT * FROM PAYMENT ORDER BY ID DESC;

SELECT * FROM PAYS ORDER BY Payment_id;

SELECT * FROM APPEAL ORDER BY ID;

SELECT * FROM APPEAL ORDER BY ID DESC;

SELECT * FROM VIOLATION_EVENT ORDER BY ID;

-- Current high-water marks (run BEFORE a live frontend action, then again AFTER)
SELECT MAX(ID) AS Current_max_user FROM "USER";
SELECT MAX(ID) AS Current_max_notice FROM NOTICE;
SELECT MAX(ID) AS Current_max_payment FROM PAYMENT;
SELECT MAX(ID) AS Current_max_appeal FROM APPEAL;

-- Latest payment / appeal / user
SELECT * FROM PAYMENT ORDER BY ID DESC FETCH FIRST 1 ROW ONLY;
SELECT * FROM APPEAL ORDER BY ID DESC FETCH FIRST 1 ROW ONLY;
SELECT * FROM "USER" ORDER BY ID DESC FETCH FIRST 1 ROW ONLY;

-- Live PAY demo: Swagata notice 12 (unpaid). Expect no Successful payment before the demo.
SELECT p.ID, p.Payment_date, p.Status, p.Amount, py.Notice_id, py.Vehicle_owner_id
FROM PAYMENT p, PAYS py
WHERE p.ID = py.Payment_id
  AND py.Notice_id = 12
ORDER BY p.ID;

-- Existing frontend Successful payment evidence (Tanisha notice 1, PAYMENT 2)
SELECT p.ID, p.Payment_date, p.Status, p.Amount, py.Notice_id, py.Vehicle_owner_id
FROM PAYMENT p
JOIN PAYS py ON py.Payment_id = p.ID
WHERE py.Notice_id = 1
ORDER BY p.ID;

-- Live APPEAL demo: Tanisha notice 2. Expect no row before Submit Appeal.
SELECT * FROM APPEAL WHERE Notice_id = 2;

-- Cursor demo pending appeal (Zubaer notice 10, APPEAL 3)
SELECT ID, Review_status, Reason, Appeal_date, Vehicle_owner_id, Notice_id
FROM APPEAL
WHERE Review_status IN ('Pending', 'Under Review')
ORDER BY ID;

-- Notice + violation type
SELECT
    n.ID AS Notice_id,
    u.First_name || ' ' || u.Last_name AS Owner_name,
    v.Licence_plate_no,
    n.Violation_event_id,
    ve.Type AS Violation_type,
    n.Fine_amount,
    n.Issue_date,
    n.Due_date
FROM NOTICE n
JOIN VIOLATION_EVENT ve ON ve.ID = n.Violation_event_id
JOIN INVOLVED_IN ii ON ii.Violation_event_id = ve.ID
JOIN VEHICLE v ON v.ID = ii.Vehicle_id
JOIN "USER" u ON u.ID = v.Vehicle_owner_id
ORDER BY n.ID;

-- Overdue unpaid notices (derived; NOTICE has no Status column)
SELECT
    n.ID AS Notice_id,
    v.Licence_plate_no,
    n.Due_date,
    n.Fine_amount
FROM NOTICE n
JOIN INVOLVED_IN ii ON ii.Violation_event_id = n.Violation_event_id
JOIN VEHICLE v ON v.ID = ii.Vehicle_id
WHERE n.Due_date < SYSDATE
  AND NOT EXISTS (
        SELECT 1
        FROM PAYS py
        JOIN PAYMENT p ON p.ID = py.Payment_id
        WHERE py.Notice_id = n.ID AND p.Status = 'Successful'
  )
  AND NOT EXISTS (
        SELECT 1 FROM APPEAL a
        WHERE a.Notice_id = n.ID
          AND a.Review_status IN ('Pending', 'Under Review', 'Approved')
  )
ORDER BY n.ID;

-- Cameras above average event volume (nested subquery, CSE-302 lecture style)
SELECT Camera_id, COUNT(*) AS Event_count
FROM CAMERA_EVENT
GROUP BY Camera_id
HAVING COUNT(*) >
(
    SELECT AVG(Event_count)
    FROM
    (
        SELECT COUNT(*) AS Event_count
        FROM CAMERA_EVENT
        GROUP BY Camera_id
    )
)
ORDER BY Event_count DESC, Camera_id;

-- Officer Verify queue: pending + confidence below 50
SELECT
    ve.ID AS Violation_event_id,
    ve.Type,
    ce.Confidence_score,
    ve.Action_taken,
    v.Licence_plate_no,
    u.First_name AS Owner_name
FROM VIOLATION_EVENT ve
JOIN CAMERA_EVENT ce ON ce.ID = ve.ID
JOIN INVOLVED_IN ii ON ii.Violation_event_id = ve.ID
JOIN VEHICLE v ON v.ID = ii.Vehicle_id
JOIN "USER" u ON u.ID = v.Vehicle_owner_id
WHERE ve.Action_taken IS NULL
  AND ce.Confidence_score < 50
ORDER BY ve.ID;

-- Function demo: violation count for Tanisha (not Arif)
SELECT FN_VIOLATION_COUNT('DHAKA-METRO-TA-21-2101') AS Violation_count FROM DUAL;

-- Weak entity EVIDENCE: identifying owner CAMERA_EVENT + partial key Evidence_number
SELECT Camera_event_id, Evidence_number, Captured_image_path, Captured_video_path
FROM EVIDENCE
ORDER BY Camera_event_id, Evidence_number;

-- RISK_ANALYSIS derived attributes (not stored columns): accident count and violation count
-- Accident = ALERT_EVENT.Type = 'Accident' on that segment during the analysis period
-- Violation = VIOLATION_EVENT rows on that segment during the analysis period
SELECT
    ra.ID AS Risk_analysis_id,
    rs.Name AS Road_segment,
    ra.Period_start,
    ra.Period_end,
    ra.Risk_level,
    (
        SELECT COUNT(*)
        FROM CAMERA cam
        JOIN CAMERA_EVENT ce ON ce.Camera_id = cam.ID
        JOIN ALERT_EVENT ae ON ae.ID = ce.ID
        WHERE cam.Road_segment_id = ra.Road_segment_id
          AND ae.Type = 'Accident'
          AND ce.Event_date BETWEEN ra.Period_start AND ra.Period_end
    ) AS Accident_count,
    (
        SELECT COUNT(*)
        FROM CAMERA cam
        JOIN CAMERA_EVENT ce ON ce.Camera_id = cam.ID
        JOIN VIOLATION_EVENT ve ON ve.ID = ce.ID
        WHERE cam.Road_segment_id = ra.Road_segment_id
          AND ce.Event_date BETWEEN ra.Period_start AND ra.Period_end
    ) AS Violation_count
FROM RISK_ANALYSIS ra
JOIN ROAD_SEGMENT rs ON rs.ID = ra.Road_segment_id
ORDER BY ra.ID;

-- Staff logins: names/emails on USER 1, 2, 6, 7, 12. Hash presence only (never SELECT the hash).
SELECT
    ID,
    First_name,
    Last_name,
    Email,
    CASE WHEN Password_hash IS NULL THEN 'NO' ELSE 'YES' END AS Has_password
FROM "USER"
WHERE ID IN (1, 2, 6, 7, 12)
ORDER BY ID;

-- ADT (Abstract Data Type.pdf): object type used as a table column.
-- Pattern: CREATE TYPE AS OBJECT, CREATE TABLE (... Report VEHICLE_REPORT_TYPE),
-- INSERT constructor, SELECT r.Report.Owner_name
SELECT
    r.ID,
    r.Report.Licence_plate_no,
    r.Report.Owner_name,
    r.Report.Fitness_status,
    r.Report.Legal_status
FROM VEHICLE_REPORT r
ORDER BY r.ID;

SELECT r.Report.Owner_name, r.Report.Fitness_status
FROM VEHICLE_REPORT r
WHERE r.Report.Licence_plate_no = 'DHAKA-METRO-SW-24-2401';

-- Explicit cursor (lecture OPEN / FETCH / %NOTFOUND / CLOSE), filled by PR_GET_PENDING_APPEALS
SELECT ID, Appeal_date, Review_status
FROM PENDING_APPEAL_LIST
ORDER BY ID;
