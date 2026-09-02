-- Refresh FACULTY-* demo NOTICE dates only.
-- Does not invent NOTICE.Status. Does not change notices 1-7 or MANUAL-* rows.
-- Event/monitor dates stay one day before Issue_date.

-- Tanisha paid
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 27, Due_date = TRUNC(SYSDATE) - 6
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-TANISHA-1');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 28 WHERE ve.Remarks = 'FACULTY-TANISHA-1';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 28,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 28, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-TANISHA-1');

-- Tanisha unpaid overdue demonstration
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 37, Due_date = TRUNC(SYSDATE) - 16
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-TANISHA-2');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 38 WHERE ve.Remarks = 'FACULTY-TANISHA-2';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 38,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 38, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-TANISHA-2');

-- Fahim payment-pending
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 20, Due_date = TRUNC(SYSDATE) + 1
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-FAHIM-PENDING');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 21 WHERE ve.Remarks = 'FACULTY-FAHIM-PENDING';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 21,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 21, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-FAHIM-PENDING');

-- Fahim unpaid / payable
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 14, Due_date = TRUNC(SYSDATE) + 7
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-FAHIM-OPEN');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 15 WHERE ve.Remarks = 'FACULTY-FAHIM-OPEN';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 15,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 15, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-FAHIM-OPEN');

-- Zubaer paid MFS
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 32, Due_date = TRUNC(SYSDATE) - 11
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-MFS');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 33 WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-MFS';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 33,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 33, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-MFS');

-- Zubaer paid bank
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 25, Due_date = TRUNC(SYSDATE) - 4
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-BANK');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 26 WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-BANK';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 26,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 26, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-BANK');

-- Relabel the paid Zubaer notice. Do not change PAYMENT/PAYS.
UPDATE VIOLATION_EVENT
SET Remarks = 'FACULTY-ZUBAER-PAID-3'
WHERE Remarks = 'FACULTY-ZUBAER-OPEN';

-- Zubaer third paid faculty notice
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 10, Due_date = TRUNC(SYSDATE) + 11
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-3');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 11 WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-3';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 11,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 11, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-ZUBAER-PAID-3');

-- Swagata paid
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 22, Due_date = TRUNC(SYSDATE) - 1
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-SWAGATA-1');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 23 WHERE ve.Remarks = 'FACULTY-SWAGATA-1';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 23,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 23, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-SWAGATA-1');

UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 18, Due_date = TRUNC(SYSDATE) + 3
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-SWAGATA-2');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 19 WHERE ve.Remarks = 'FACULTY-SWAGATA-2';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 19,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 19, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-SWAGATA-2');

-- Akhlak appeal-rejected (still payable; due remains in the future)
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 15, Due_date = TRUNC(SYSDATE) + 6
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-AKHLAK-APPEAL');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 16 WHERE ve.Remarks = 'FACULTY-AKHLAK-APPEAL';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 16,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 16, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-AKHLAK-APPEAL');

-- Akhlak paid
UPDATE NOTICE n SET Issue_date = TRUNC(SYSDATE) - 8, Due_date = TRUNC(SYSDATE) + 13
WHERE n.Violation_event_id IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-AKHLAK-OPEN');
UPDATE VIOLATION_EVENT ve SET Monitor_date = TRUNC(SYSDATE) - 9 WHERE ve.Remarks = 'FACULTY-AKHLAK-OPEN';
UPDATE CAMERA_EVENT ce SET Event_date = TRUNC(SYSDATE) - 9,
  Event_time = TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 9, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS')
WHERE ce.ID IN (SELECT ve.ID FROM VIOLATION_EVENT ve WHERE ve.Remarks = 'FACULTY-AKHLAK-OPEN');

COMMIT;

-- Insert FACULTY-AKHLAK-OVERDUE only when that remark is missing.
-- Prefer: node scripts/seed-faculty-demo.mjs  (creates the notice through the seed helper)
-- This block is the SQL equivalent for a database that already has the Akhlak owner/vehicle.
DECLARE
  v_exists NUMBER;
  v_event_id NUMBER;
  v_vehicle_id NUMBER;
  v_camera_id NUMBER;
  v_officer_id NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists
  FROM VIOLATION_EVENT
  WHERE Remarks = 'FACULTY-AKHLAK-OVERDUE';

  IF v_exists = 0 THEN
    SELECT ID INTO v_vehicle_id
    FROM VEHICLE
    WHERE Licence_plate_no = 'DHAKA-METRO-AK-25-2501';

    SELECT ID INTO v_camera_id
    FROM CAMERA
    ORDER BY ID
    FETCH FIRST 1 ROW ONLY;

    SELECT ID INTO v_officer_id
    FROM TRAFFIC_OFFICER
    ORDER BY ID
    FETCH FIRST 1 ROW ONLY;

    INSERT INTO CAMERA_EVENT (Camera_id, Event_date, Event_time, Confidence_score)
    VALUES (
      v_camera_id,
      TRUNC(SYSDATE) - 41,
      TO_TIMESTAMP(TO_CHAR(TRUNC(SYSDATE) - 41, 'YYYY-MM-DD') || ' 10:00:00', 'YYYY-MM-DD HH24:MI:SS'),
      90.00
    )
    RETURNING ID INTO v_event_id;

    INSERT INTO VIOLATION_EVENT (ID, Type, Lane_number, Traffic_officer_id, Monitor_date, Action_taken, Remarks)
    VALUES (v_event_id, 'Illegal Parking', 1, v_officer_id, TRUNC(SYSDATE) - 41, 'Confirmed', 'FACULTY-AKHLAK-OVERDUE');

    INSERT INTO INVOLVED_IN (Vehicle_id, Violation_event_id)
    VALUES (v_vehicle_id, v_event_id);

    INSERT INTO NOTICE (Issue_date, Due_date, Fine_amount, Violation_event_id)
    VALUES (TRUNC(SYSDATE) - 40, TRUNC(SYSDATE) - 19, 2100, v_event_id);
  END IF;
END;
/

COMMIT;
