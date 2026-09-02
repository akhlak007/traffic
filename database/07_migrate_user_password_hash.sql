-- Historical migration for databases that still have OWNER_CREDENTIAL.
-- Fresh installs should use database/01_create_tables.sql instead:
-- "USER".Password_hash VARCHAR2(255) and no OWNER_CREDENTIAL table.
--
-- Actual relationship used here (from live constraints):
--   OWNER_CREDENTIAL.User_id -> "USER".ID
--   VEHICLE_OWNER.ID         -> "USER".ID
-- There is no VEHICLE_OWNER.User_id column.
SET SQLBLANKLINES ON

ALTER TABLE "USER" ADD Password_hash VARCHAR2(255);

UPDATE "USER" u
SET Password_hash = (
    SELECT c.Password_hash
    FROM OWNER_CREDENTIAL c
    WHERE c.User_id = u.ID
)
WHERE EXISTS (
    SELECT 1
    FROM OWNER_CREDENTIAL c
    WHERE c.User_id = u.ID
);

-- Run these checks before DROP:
--   credential count = migrated USER rows with Password_hash
--   each OWNER_CREDENTIAL.Password_hash equals "USER".Password_hash for the same ID
DROP TABLE OWNER_CREDENTIAL;
