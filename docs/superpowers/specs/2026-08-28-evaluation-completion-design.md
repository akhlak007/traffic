# Evaluation Completion Design

## Purpose

Complete the existing Smart Traffic Violation and Traffic Management System for presentation and evaluation without changing its conceptual ER design, role model, visual language, or established workflows. Existing functional reads and mutations remain in place. Missing Oracle course concepts and incomplete frontend actions are integrated into the role pages where they naturally belong.

## Audit Baseline

| Requirement | Present | Functional | Frontend connected | Decision |
|---|---|---|---|---|
| Frontend pages | Yes, 20 HTML pages | Partial | Most reads | Keep pages; complete essential actions and module views |
| Stored function | No | No | No | Add violation-count function |
| Subquery | Yes | Yes | Yes | Keep existing subqueries and add an explicit report |
| View | No | No | No | Add vehicle-violation view |
| Abstract data type | No | No | No | Add a report object type and object-column view |
| PL/SQL procedure | No business procedure | No | No | Add violation-verification procedure |
| Cursor | Implicit teardown loops only | Not demonstrable | No | Add pending-appeal ref-cursor procedure |
| PL/SQL exceptions | No | No | No | Add controlled application exceptions |

Existing strengths to preserve include role-authorized APIs, Oracle pooling, owner scoping, the mock/live data gateway, database viewer, vehicle/status/notices reads, event/evidence reads, DMP journey lookup, appeal creation/review, pending payment creation, ISA tables, event specialization, payment specialization, relationship tables, constraints, indexes, and the `EVIDENCE` weak entity.

## Non-Goals

- No table, key, relationship, cardinality, ISA, or weak-entity redesign.
- No real bank/MFS gateway, evidence upload service, AI model, map provider, or individual credential system.
- No broad user administration or unrelated CRUD expansion.
- No visual redesign beyond fitting new data and controls into existing components.
- No destructive reset or reseed of the configured Oracle schema during validation.

## Oracle Objects

### `FN_VIOLATION_COUNT`

`FN_VIOLATION_COUNT(p_licence_plate_no VARCHAR2) RETURN NUMBER` verifies that the vehicle exists and returns the number of rows connecting that plate to `VIOLATION_EVENT` through `INVOLVED_IN`. A missing vehicle raises application error `-20001` with a stable message. The DMP vehicle lookup calls the function through the reports API and displays `Total violations`.

### `VEHICLE_VIOLATION_VIEW`

The relational view contains one row per vehicle/violation involvement with licence plate, owner ID/name, violation event ID/type/date, notice ID, fine amount, and derived notice/payment state. Payment and appeal state use correlated `EXISTS` expressions rather than direct joins, so multiple payment attempts cannot multiply rows. State precedence is no notice (`not-issued`), successful payment (`paid`), approved appeal (`dismissed`), pending/under-review appeal (`appealed`), pending payment (`payment-pending`), overdue, then pending. The view reuses `VEHICLE`, `VEHICLE_OWNER`, quoted `"USER"`, `INVOLVED_IN`, `VIOLATION_EVENT`, `CAMERA_EVENT`, `NOTICE`, `PAYS`, `PAYMENT`, and `APPEAL`. The DMP lookup displays matching rows, and the backend queries the view rather than duplicating its joins.

### `VEHICLE_REPORT_TYPE` and `VEHICLE_REPORT_OBJECT_VIEW`

`VEHICLE_REPORT_TYPE` is a standalone Oracle object type containing licence plate, owner name, fitness status, current legal status, and violation count. `VEHICLE_REPORT_OBJECT_VIEW` constructs one object value per vehicle from existing relational data. Current legal status is the newest row whose `Effective_date <= SYSDATE` and whose expiry is null or not earlier than today, ordered by `Effective_date DESC, Status_id DESC`; no qualifying row yields `Normal`. It is a reporting object only; no existing table receives an object-type column. The reports API selects the object's attributes and the DMP lookup displays them in the vehicle profile.

### `PR_GET_PENDING_APPEALS`

`PR_GET_PENDING_APPEALS(p_result OUT SYS_REFCURSOR)` opens a ref cursor over pending and under-review appeals, including notice, vehicle, reason, date, and fine. `GET /api/reports/pending-appeals` binds the cursor, fetches all rows, closes it, and returns JSON. The supervisor appeal page uses this queue.

### `PR_VERIFY_VIOLATION`

`PR_VERIFY_VIOLATION(p_event_id, p_officer_id, p_decision, p_remarks)`:

1. Validates `p_decision` as `Confirmed` or `Rejected`.
2. Verifies that the violation event and traffic officer exist.
3. Rejects an event already present in `MONITORS_VIOLATION`.
4. Inserts the officer, current date, canonical `Action_taken` value (`Confirmed` or `Rejected`), and remarks into `MONITORS_VIOLATION`.
5. Handles missing records, duplicate decisions, and invalid decisions with stable `RAISE_APPLICATION_ERROR` codes; unexpected errors propagate to the existing generic database-error path.

The existing violation resource derives `pending-review` when no monitoring row exists, `rejected` only when `Action_taken = 'Rejected'`, and `confirmed` for `Confirmed` plus all existing legacy monitoring actions. No verification table or new entity is introduced.

Procedure codes are `-20011` violation not found, `-20012` officer not found, `-20013` invalid decision, and `-20014` already verified. They map respectively to `404`, `404`, `400`, and `409`. Unexpected Oracle failures are logged server-side and return the existing generic `500` response. Function code `-20001` maps to `404 Vehicle not found`.

### Subquery Demonstration

`GET /api/reports/cameras-above-average` uses `CAMERA LEFT JOIN CAMERA_EVENT`, so zero-event cameras participate in the average, and returns cameras whose event count exceeds that average. The fresh seed adds one pending event to camera 301, producing a visible above-average result. The admin dashboard displays the result in a table. Existing correlated notice, role, and event subqueries remain unchanged where still appropriate.

## Backend API Changes

### Existing APIs Retained

All current health, vehicle, vehicle-status, notice read, appeal, payment creation, resource, and database-viewer routes remain.

The existing camera-events read route additionally authorizes admin because the API-backed admin dashboard consumes that resource. Its SQL and other authorized roles remain unchanged.

### New Report APIs

| Method | Path | Roles | Concept |
|---|---|---|---|
| `GET` | `/api/reports/cameras-above-average` | admin | Subquery |
| `GET` | `/api/reports/vehicle-violations/:plate` | admin, officer, dmp | View |
| `GET` | `/api/reports/vehicle-profile/:plate` | admin, dmp | Function and ADT |
| `GET` | `/api/reports/pending-appeals` | supervisor | Ref cursor |

### New Workflow APIs

| Method | Path | Roles | Purpose |
|---|---|---|---|
| `PATCH` | `/api/violations/:eventId/verification` | officer | Call `PR_VERIFY_VIOLATION` |
| `POST` | `/api/notices` | officer | Issue a notice only for a confirmed violation |
| `GET` | `/api/payments` | owner | Return owner-scoped payment history |
| `GET` | `/api/congestion-events` | officer, dmp | Display congestion subtype records |
| `POST` | `/api/cameras` | admin | Add a camera using existing columns |
| `PATCH` | `/api/cameras/:cameraId` | admin | Update a camera using existing columns |
| `POST` | `/api/zones` | admin | Add a zone using existing columns |
| `PATCH` | `/api/zones/:zoneId` | admin | Update a zone using existing columns |

Notice issuance uses identity-generated `Notice_id`, validates positive fine and due date, confirms that the event is verified and not rejected, and relies on the existing unique violation constraint. Owner payment and appeal are available only when the violation has exactly one involved vehicle and that vehicle belongs to the authenticated owner. Multi-vehicle events remain visible to staff but are marked for manual handling rather than being exposed as payable or appealable to multiple owners. Camera and zone writes use existing constraints and do not add entities.

Camera mutations accept `status` as `online`, `offline`, or `degraded` and normalize those values to `Active`, `Inactive`, or `Under Maintenance`. Create requires road segment, model, camera type, positive lane number, and confidence from 0 through 100. Patch accepts the same mutable fields, requires at least one field, and leaves omitted fields unchanged. Zone create requires name, area, and `safe`, `warning`, or `danger`; zone patch uses the same partial-update rule.

### Existing Workflow Corrections

- Notice state reports an approved appeal as `dismissed`, and payment rejects dismissed notices.
- Appeal review updates only `Pending` or `Under Review` rows; repeated review returns `409`.
- Payment creation locks the target `NOTICE` row with `SELECT ... FOR UPDATE` before checking attempts, then rejects another pending or successful payment for that notice with `409`. This serializes concurrent requests without adding a constraint or changing the ER model.
- Owner appeal, payment, and notice-action queries require exactly one involved vehicle and matching ownership. Staff reports retain all involvement rows.

### Error Contract

Known PL/SQL application codes map to user-facing messages and HTTP status codes. Missing records return `404`, invalid decisions/inputs return `400`, and already-processed records return `409`. Raw Oracle messages, SQL text, stack traces, and bind values are never returned. Unknown database errors continue through the existing generic error reporter.

### JSON Contracts

- Cameras-above-average returns `{ cameraId, model, eventCount, averageEventCount }[]`.
- Vehicle violations returns `{ licensePlate, ownerId, ownerName, violationEventId, violationType, eventDate, noticeId, fineAmount, noticeStatus }[]`.
- Vehicle profile returns `{ licensePlate, ownerName, fitnessStatus, legalStatus, violationCount }` or `404`.
- Pending appeals returns `{ appealId, noticeId, licensePlate, reason, appealDate, fineAmount, reviewStatus }[]`.
- Payment history returns `{ paymentId, noticeId, paymentDate, status, amount, method, reference }[]`.
- Congestion events returns `{ congestionEventId, cameraId, roadSegmentId, severity, vehicleCount, duration, capturedAt }[]`.
- Verification mutation returns `{ violationEventId, verificationStatus, officerId }`.
- Notice creation returns `{ noticeId, violationEventId, issueDate, dueDate, fineAmount }`.
- Camera and zone create/update mutations return the same field shape used by their existing read resources.

## Frontend Changes

### Authentication

Live login calls the authenticated health endpoint before redirecting. The response includes the authenticated role and user ID. A token-role mismatch stays on the login page with a clear error. Demo behavior remains unchanged.

### Admin

- Dashboard metrics load cameras, zones, users, camera events, and the cameras-above-average report.
- Camera Add/Edit forms call the new camera mutations and refresh the inventory.
- Zone Add/Configure forms call the new zone mutations.
- The zone page displays a searchable road-segment table using the existing road-segment endpoint.
- User administration remains a searchable read-only role registry; unsupported invitation/permission buttons are removed rather than simulated.

### Traffic Officer

- Verification Confirm/Reject opens a labeled remarks form, calls the verification API, refreshes the queue, and shows friendly conflicts.
- Verification continues to display event and evidence metadata using existing resources.
- Notices provide a detail action and an issue form populated from confirmed violations.
- Incidents use tabs for alerts, road defects, and congestion. The unsupported mock report form is removed; no false persistence is presented.

### Supervisor

- The actionable queue loads from the cursor-backed pending report; the retained appeals endpoint supplies a separate read-only review-history list.
- The selected appeal displays its related violation and evidence metadata before review.
- Finalized appeals are read-only and cannot be submitted again.

### Vehicle Owner

- Notices route Pay/Appeal actions only from eligible notices.
- Direct Pay and Appeal navigation first presents an eligible notice selector.
- Payment page shows owner-scoped payment history and blocks duplicate pending/successful payments.
- Dismissed notices are labeled and have no payment action.

### DMP

- Dashboard displays suspicious-event records instead of only their count.
- Vehicle lookup displays the function result, ADT-derived profile, view-based violation rows, existing vehicle status, and journey timeline.

### Shared Navigation

All existing role links remain. No separate coursework-only demonstration page is added. Existing pages demonstrate the required concepts in context.

## Data Flow

Every required concept follows the same chain:

`role page -> page.js -> api.js -> authenticated Express route -> controller -> node-oracledb -> Oracle object/query -> JSON alias contract -> page renderer`

Demo mode uses deterministic local data and clearly identifies non-persistent actions. Live workflow actions never report success without an API response.

## SQL Lifecycle

The create script defines the type before its dependent object view, while table-dependent functions, views, and procedures follow table creation. Existing installations receive a separate non-destructive upgrade script. Its idempotent ADT order is: drop only `VEHICLE_REPORT_OBJECT_VIEW` if present, create or replace `VEHICLE_REPORT_TYPE`, then recreate the object view; other views, functions, and procedures use `CREATE OR REPLACE`. The teardown script removes views, procedures, functions, and types before tables.

For fresh installations, the seed adds event 1026 as a violation for camera 301, links one vehicle through `INVOLVED_IN`, and intentionally creates neither a notice nor `MONITORS_VIOLATION` row for it. Existing seeded events and notices remain unchanged. This supplies a coherent pending-verification item and makes camera 301 exceed the all-camera average.

An upgraded retained schema is not modified merely to manufacture presentation data. Verification and cameras-above-average pages therefore define explicit empty states. Non-destructive Oracle procedure tests temporarily remove and restore one monitoring row inside a transaction; report tests accept an empty above-average result as valid. A fresh evaluation setup gets the visible event 1026 fixture through the normal seed script.

## Testing

### Static and Unit Tests

- Validate JavaScript, JSON, HTML references, all table names, new object declarations, and teardown coverage.
- Assert API endpoint mappings, route roles, response aliases, Oracle call shape, OUT binds, cursor closure, and PL/SQL error mapping.
- Test appeal final-state protection, dismissed-notice payment rejection, duplicate pending payment rejection, owner scoping, notice issuance, and verification conflicts.

### Browser Tests

- Exercise login validation, every sidebar link, direct Pay/Appeal selection, filters, dialogs, forms, verification, notice issuance, payment, appeal, cursor queue, report displays, empty states, and error states with intercepted deterministic API responses for mutations.
- Run representative admin, officer, supervisor, owner, and DMP flows at desktop and mobile viewport sizes.

### Non-Destructive Oracle Tests

- Apply the upgrade script without dropping tables or reseeding.
- Query `USER_ERRORS` to confirm all new objects compile.
- Execute function, view, ADT-view, subquery, and cursor reads.
- Exercise verification success by deleting one existing monitoring row under a savepoint, calling the procedure, and rolling back; exercise exception paths against existing rows. The procedure contains no `COMMIT` or `ROLLBACK`, and the test does not consume identity values.
- Re-run existing appeal/payment reads without altering retained project data.

Backend mutation routes are tested with injected/mock Oracle connections so commit behavior and error mapping are covered without changing retained data. Live Oracle validation is limited to read APIs and rollback-safe direct database calls; browser tests do not submit committed mutations to the retained schema.

If the configured Oracle service is unavailable, static/unit/browser results are reported separately and Oracle execution remains an explicit limitation rather than being represented as passed.

## Completion Evidence

The final project report will inventory every frontend page, backend API, and Oracle object, then map each required concept to its page and route. It will separately list features retained, updated, and newly added, plus any environment-dependent limitations.
