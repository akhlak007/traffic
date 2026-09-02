-- Idempotent teardown for the SMART_TRAFFIC coursework schema.
-- Run as SMART_TRAFFIC. Only explicitly listed project objects are removed.

BEGIN
    FOR object_row IN (
        SELECT object_name, object_type
        FROM user_objects
        WHERE (object_type = 'VIEW' AND object_name IN (
                   'VEHICLE_REPORT_OBJECT_VIEW', 'VEHICLE_VIOLATION_VIEW'
               ))
           OR (object_type = 'PROCEDURE' AND object_name IN (
                   'PR_GET_PENDING_APPEALS', 'PR_VERIFY_VIOLATION'
               ))
           OR (object_type = 'FUNCTION' AND object_name = 'FN_VIOLATION_COUNT')
    ) LOOP
        EXECUTE IMMEDIATE 'DROP ' || object_row.object_type || ' "' || object_row.object_name || '"';
    END LOOP;
END;
/

BEGIN
    FOR object_row IN (
        SELECT type_name AS object_name
        FROM user_types
        WHERE type_name = 'VEHICLE_REPORT_TYPE'
    ) LOOP
        EXECUTE IMMEDIATE 'DROP TYPE "' || object_row.object_name || '" FORCE';
    END LOOP;
END;
/

-- Remove named generators left by schema versions that predate identity columns.
BEGIN
    FOR object_row IN (
        SELECT sequence_name AS object_name
        FROM user_sequences
        WHERE sequence_name IN ('APPEAL_SEQ', 'PAYMENT_SEQ', 'CASE_RECORD_SEQ')
    ) LOOP
        EXECUTE IMMEDIATE 'DROP SEQUENCE "' || object_row.object_name || '"';
    END LOOP;
END;
/

BEGIN
    FOR object_row IN (
        SELECT table_name AS object_name
        FROM user_tables
        WHERE table_name IN (
            'MONITORS', 'CASE_RECORD', 'SUPERVISION', 'REVIEWS_ROAD_DEFECT',
            'MONITORS_ALERT', 'MONITORS_CONGESTION', 'MONITORS_VIOLATION',
            'REVIEWS_APPEAL', 'PAYS', 'IDENTIFIED_IN', 'INVOLVED_IN',
            'VEHICLE_REPORT', 'PENDING_APPEAL_LIST',
            'VEHICLE_JOURNEY', 'RISK_ANALYSIS', 'RHD', 'APPEAL', 'BY_MFS',
            'BY_BANK', 'PAYMENT', 'NOTICE', 'EVIDENCE', 'ROAD_DEFECT_EVENT',
            'ALERT_EVENT', 'CONGESTION_EVENT', 'SUSPICIOUS_VEHICLE_EVENT',
            'VIOLATION_EVENT', 'CAMERA_EVENT', 'VEHICLE_STATUS', 'VEHICLE',
            'CAMERA', 'ROAD_SEGMENT', 'OWNER_CREDENTIAL', 'VEHICLE_OWNER', 'TRAFFIC_OFFICER',
            'ZONE', 'DMP_OFFICER', 'SUPERVISOR', 'ADMIN', 'PHONE', 'USER',
            'USER_ACCOUNT'
        )
    ) LOOP
        EXECUTE IMMEDIATE 'DROP TABLE "' || object_row.object_name || '" CASCADE CONSTRAINTS PURGE';
    END LOOP;
END;
/
