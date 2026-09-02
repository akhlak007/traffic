
SELECT
    v.Licence_plate_no,
    ua.First_name || ' ' || ua.Last_name AS Owner_name,
    ve.Type AS Violation_type,
    ce.Event_date,
    n.Notice_id,
    n.Fine_amount
FROM VEHICLE v
JOIN VEHICLE_OWNER vo
    ON v.Vehicle_owner_id = vo.User_id
JOIN "USER" ua
    ON vo.User_id = ua.User_id
JOIN INVOLVED_IN ii
    ON v.Licence_plate_no = ii.Licence_plate_no
JOIN VIOLATION_EVENT ve
    ON ii.Violation_event_id = ve.Event_id
JOIN CAMERA_EVENT ce
    ON ve.Event_id = ce.Event_id
JOIN NOTICE n
    ON ve.Event_id = n.Violation_event_id
ORDER BY n.Fine_amount DESC;

SELECT
    c.Case_id,
    c.Licence_plate_no,
    c.Case_type,
    c.Case_status,
    ua.First_name || ' ' || ua.Last_name AS DMP_officer_name,
    m.Monitor_date,
    m.Remarks
FROM CASE_RECORD c
JOIN MONITORS m
    ON c.Case_id = m.Case_id
JOIN DMP_OFFICER d
    ON m.Dmp_officer_id = d.User_id
JOIN "USER" ua
    ON d.User_id = ua.User_id
ORDER BY m.Monitor_date;

SELECT
    rs.Name AS Road_segment,
    COUNT(ce.Event_id) AS Congestion_event_count,
    ROUND(AVG(ce.Vehicle_count), 2) AS Average_vehicle_count,
    MAX(ce.Vehicle_count) AS Highest_vehicle_count
FROM CONGESTION_EVENT ce
JOIN CAMERA_EVENT cme
    ON ce.Event_id = cme.Event_id
JOIN CAMERA c
    ON cme.Camera_id = c.Camera_id
JOIN ROAD_SEGMENT rs
    ON c.Road_segment_id = rs.Road_segment_id
GROUP BY rs.Name
HAVING COUNT(ce.Event_id) >= 1
ORDER BY Average_vehicle_count DESC;

WITH VIOLATION_SUMMARY AS (
    SELECT
        rs.Road_segment_id,
        rs.Name,
        COUNT(ve.Event_id) AS Violation_count
    FROM ROAD_SEGMENT rs
    LEFT JOIN CAMERA c
        ON rs.Road_segment_id = c.Road_segment_id
    LEFT JOIN CAMERA_EVENT ce
        ON c.Camera_id = ce.Camera_id
    LEFT JOIN VIOLATION_EVENT ve
        ON ce.Event_id = ve.Event_id
    GROUP BY
        rs.Road_segment_id,
        rs.Name
)
SELECT
    Road_segment_id,
    Name,
    Violation_count,
    DENSE_RANK() OVER (
        ORDER BY Violation_count DESC
    ) AS Violation_rank
FROM VIOLATION_SUMMARY
ORDER BY Violation_rank, Name;
SELECT
    Payment_method,
    Status,
    COUNT(*) AS Number_of_payments,
    SUM(Amount) AS Total_amount
FROM (
    SELECT
        p.Payment_id,
        p.Status,
        p.Amount,
        'BANK' AS Payment_method
    FROM PAYMENT p
    JOIN BY_BANK b
        ON p.Payment_id = b.Payment_id

    UNION ALL

    SELECT
        p.Payment_id,
        p.Status,
        p.Amount,
        'MFS' AS Payment_method
    FROM PAYMENT p
    JOIN BY_MFS m
        ON p.Payment_id = m.Payment_id
)
GROUP BY
    Payment_method,
    Status
ORDER BY
    Payment_method,
    Status;
