# AI Agent Prompt: Implement Project Update-3 Requirements

> **Instructions for the AI Developer / Agent:**
> Read this entire prompt carefully before making any changes. You are tasked with implementing the missing requirements for **Project Update-3** in the Bangladesh AI Traffic Management System codebase.
> 
> ⚠️ **CRITICAL CONSTRAINT:**
> **DO NOT break or alter any existing core business logic, table structures, schemas, role-based authentication, or UI workflows.** All changes must be strictly **additive and backward-compatible**, seamlessly integrating with the existing architecture.

---

## 1. Project Background & Current State

- **Stack:**
  - Frontend: Vanilla HTML5, CSS (`tokens.css`, `components.css`), ES Modules JavaScript (`js/api.js`, `js/page.js`, `js/shell.js`, etc.).
  - Backend: Node.js (ES modules), Express, `oracledb` connection pool (`backend/config/database.js`).
  - Database: Oracle Database (schema: `SMART_TRAFFIC` / `FREEPDB1`).
- **Current Gaps to Address:**
  1. **Triggers & Sequences:** No explicit `CREATE OR REPLACE TRIGGER` or standalone `CREATE SEQUENCE` currently exist.
  2. **Database Search through Frontend:** Most search inputs perform client-side DOM filtering on preloaded arrays. A real backend-driven SQL `LIKE` search connected to the frontend is needed.
  3. **Common Table Expression (CTE) via `WITH` Clause:** Query 4 in `database/03_advanced_queries.sql` uses a CTE with `WITH ... AS` and `DENSE_RANK()`, but it is not exposed in the API or rendered in any frontend dashboard.

---

## 2. Requirement Details & Implementation Specifications

### Feature A: Implement Oracle Sequences & Triggers
Create a new non-destructive migration script: `database/09_project_update_3_triggers_sequences.sql`.

1. **Standalone Sequences:**
   - Create explicit sequences with safe `START WITH` and `INCREMENT BY 1`:
     ```sql
     CREATE SEQUENCE AUDIT_LOG_SEQ START WITH 1 INCREMENT BY 1 NOCACHE;
     CREATE SEQUENCE CASE_RECORD_SEQ START WITH 1000 INCREMENT BY 1 NOCACHE;
     ```
   - If an audit table does not exist, create a lightweight table for operational audit events:
     ```sql
     CREATE TABLE SYSTEM_AUDIT_LOG (
         Log_id NUMBER PRIMARY KEY,
         Entity_name VARCHAR2(50) NOT NULL,
         Entity_id NUMBER,
         Action_type VARCHAR2(30) NOT NULL,
         Details VARCHAR2(400),
         Created_at DATE DEFAULT SYSDATE
     );
     ```

2. **Database Triggers (`CREATE OR REPLACE TRIGGER`):**
   - **Trigger 1 (Sequence + Audit Trigger):**
     Create a `BEFORE INSERT` trigger on `SYSTEM_AUDIT_LOG` using `AUDIT_LOG_SEQ.NEXTVAL`:
     ```sql
     CREATE OR REPLACE TRIGGER TRG_AUDIT_LOG_ID
     BEFORE INSERT ON SYSTEM_AUDIT_LOG
     FOR EACH ROW
     BEGIN
         IF :NEW.Log_id IS NULL THEN
             :NEW.Log_id := AUDIT_LOG_SEQ.NEXTVAL;
         END IF;
     END;
     /
     ```
   - **Trigger 2 (Business Rule & Auto-Audit Trigger on Notices):**
     Create an `AFTER INSERT` trigger on `NOTICE` that logs notice issuance into `SYSTEM_AUDIT_LOG`:
     ```sql
     CREATE OR REPLACE TRIGGER TRG_NOTICE_ISSUED_AUDIT
     AFTER INSERT ON NOTICE
     FOR EACH ROW
     BEGIN
         INSERT INTO SYSTEM_AUDIT_LOG (Log_id, Entity_name, Entity_id, Action_type, Details, Created_at)
         VALUES (
             AUDIT_LOG_SEQ.NEXTVAL,
             'NOTICE',
             :NEW.ID,
             'NOTICE_ISSUED',
             'Notice issued for violation event ' || :NEW.Violation_event_id || ' with fine ' || :NEW.Fine_amount,
             SYSDATE
         );
     END;
     /
     ```
   - **Trigger 3 (Integrity / Validation Trigger):**
     Create a `BEFORE INSERT OR UPDATE` trigger on `NOTICE` preventing invalid zero or negative fines:
     ```sql
     CREATE OR REPLACE TRIGGER TRG_VALIDATE_NOTICE_FINE
     BEFORE INSERT OR UPDATE ON NOTICE
     FOR EACH ROW
     BEGIN
         IF :NEW.Fine_amount <= 0 THEN
             RAISE_APPLICATION_ERROR(-20020, 'Fine amount must be strictly greater than zero.');
         END IF;
     END;
     /
     ```

---

### Feature B: Implement Database Search Functionality through Frontend

1. **Backend API Endpoint:**
   - Update `backend/controllers/noticeController.js` and `backend/routes/noticeRoutes.js` (or add a dedicated search controller):
   - Accept query parameter `?search=` on `GET /api/notices`:
     - When `search` is provided:
       - Validate and sanitize the search string (alphanumeric, spaces, hyphens).
       - Query Oracle using parameterized `LIKE`:
         ```sql
         SELECT ... FROM (...) 
         WHERE (LOWER(v.Licence_plate_no) LIKE :searchParam 
            OR LOWER(ve.Type) LIKE :searchParam 
            OR TO_CHAR(n.ID) = :exactNoticeId)
         ```
       - Bind `:searchParam` as `%${search.toLowerCase()}%`.
     - Retain owner-scoping: If `req.user.role === 'owner'`, always enforce `v.Vehicle_owner_id = :ownerId`.
   - Update `mock-data/` / mock handler in `js/api.js` so that offline mode also supports `?search=`.

2. **Frontend Search Experience:**
   - In `js/page.js` on the Officer Notices (`pages/officer-notices.html`) and Owner Notices (`pages/owner-notices.html`) views:
     - Enhance the search field to perform server-backed database searching when the user submits or types (with debounce):
     - When submitted, call `list("notices", { search: query })` via `js/api.js`.
     - Render results with loading indicator and graceful empty state (`"No notices matching database query"`).

---

### Feature C: Implement Queries Using Common Table Expressions (CTE via `WITH` Clause)

1. **Backend Integration:**
   - Create endpoint `GET /api/evaluation/road-violation-rankings` in `backend/controllers/evaluationController.js` and register it in `backend/routes/evaluationRoutes.js`.
   - Use the CTE query from `database/03_advanced_queries.sql`:
     ```sql
     WITH VIOLATION_SUMMARY AS (
         SELECT
             rs.ID AS "roadSegmentId",
             rs.Name AS "roadSegmentName",
             COUNT(ve.ID) AS "violationCount"
         FROM ROAD_SEGMENT rs
         LEFT JOIN CAMERA c
             ON rs.ID = c.Road_segment_id
         LEFT JOIN CAMERA_EVENT ce
             ON c.ID = ce.Camera_id
         LEFT JOIN VIOLATION_EVENT ve
             ON ce.ID = ve.ID
         GROUP BY
             rs.ID,
             rs.Name
     )
     SELECT
         "roadSegmentId",
         "roadSegmentName",
         "violationCount",
         DENSE_RANK() OVER (ORDER BY "violationCount" DESC) AS "violationRank"
     FROM VIOLATION_SUMMARY
     ORDER BY "violationRank", "roadSegmentName"
     ```
   - Role authorization: allow `officer`, `admin`, `dmp`, and `supervisor`.
   - Return structured JSON array.

2. **Frontend UI Integration:**
   - In `js/api.js`, register the endpoint under `apiMap`:
     ```javascript
     roadViolationRankings: "/api/evaluation/road-violation-rankings"
     ```
   - In `js/page.js`, add a dedicated section or card displaying this CTE-driven report:
     - Suggested view: `officer-dashboard.html` or `admin-dashboard.html`.
     - Render a sleek table showing:
       - **Rank** (from `DENSE_RANK()`)
       - **Road Segment**
       - **Total Violations**
     - Add mock data in `mock-data/` for offline demo compatibility.

---

### Feature D: Address Previous Instructor Feedbacks
- Ensure all previously covered advanced SQL constructs remain functional and demonstrable:
  1. Multi-table joins (6+ tables).
  2. Aggregate functions with `GROUP BY` and `HAVING`.
  3. Window functions (`DENSE_RANK() OVER (...)`).
  4. CTE queries (`WITH ... AS`).
  5. PL/SQL Stored Functions, Procedures, Ref Cursors, and ADT types.
  6. Database Triggers and Sequences.

---

## 3. Verification & Testing Steps

1. **Database Scripts:**
   - Test execution of `database/09_project_update_3_triggers_sequences.sql` in Oracle SQL*Plus.
   - Verify triggers fire on inserts into `NOTICE` and records are written to `SYSTEM_AUDIT_LOG`.
   - Verify invalid notice fines (`Fine_amount <= 0`) are blocked by `TRG_VALIDATE_NOTICE_FINE`.
2. **Backend Tests:**
   - Run `npm test` inside `backend/` to ensure all existing test suites pass.
   - Add unit tests in `backend/tests/` for the new CTE endpoint and search query handling.
3. **Frontend Validation:**
   - Test both **Live Oracle Mode** and **Offline Demo Mode**.
   - Test typing a search term in the frontend search bar and verify that filtered results return from the database.
   - Verify the CTE violation ranking table renders cleanly in the dashboard.
