# AI Traffic Management System — Project Map

Last updated: 2026-08-18
Current milestone: secure dual-mode full-stack coursework prototype

## Architecture

| Layer | Location | Responsibility |
| --- | --- | --- |
| Role pages | `index.html`, `pages/` | Multi-page responsive user interface |
| Shared frontend | `js/`, `css/` | Shell, access mode, rendering, components, charts |
| Demo data | `mock-data/` | Self-contained, non-persistent demonstration mode |
| API | `backend/` | Authenticated Express/Oracle read and workflow endpoints |
| Oracle schema | `database/` | DDL, deterministic seed data, reports, teardown |
| Verification | `backend/tests/`, `backend/scripts/`, `.github/workflows/` | API tests, static checks, CI |

Demo mode never calls the backend. Live mode never substitutes mock entities for missing Oracle resources, preventing mixed identifier contracts.

## Roles and routes

| Role | Pages | Live API scope |
| --- | --- | --- |
| Administrator | dashboard, cameras, zones, users, database viewer | infrastructure, users, restricted schema viewer |
| Traffic Officer | dashboard, verification, notices, incidents | operational events, evidence, vehicles, notices |
| Supervisor | dashboard, appeals | appeals, notices, violations, review mutation |
| Vehicle Owner | dashboard, vehicles, notices, payment, appeal | server-scoped owner vehicles/notices/statuses/appeals |
| DMP Officer | dashboard, vehicle lookup | watch status, cases, risk, vehicle journeys |

Frontend navigation is not an authorization boundary. The backend bearer-token principal and route middleware enforce live permissions.

## Data contracts

`js/api.js` owns data-mode selection and exposes `list`, `get`, and `mutate`. Live endpoints and JSON files use the same camelCase field names within their respective mode. Important normalized fields include:

| Resource | Stable fields |
| --- | --- |
| Vehicle | `vehicleId`, `licensePlate`, `ownerId`, `fitnessStatus`, `type`, `model`, `color` |
| Vehicle status | `statusId`, `vehicleId`, `status`, `reason`, `remarks`, effective/expiry dates |
| Notice | `noticeId`, `violationEventId`, `vehicleId`, `ownerId`, amount/dates, `status` |
| Appeal | `appealId`, `noticeId`, `ownerId`, `reviewStatus`, reason/dates/decision/remarks |
| Journey | `journeyId`, `vehicleId`, camera/times, distance, speed, interval location |

Live lists are capped at 100 records. Production-scale event streams will need cursor pagination.

## Database decisions

- Licence plates use `VARCHAR2(30)` consistently.
- `SUPERVISOR` is a user subtype and owns appeal reviews.
- Multiple cases per vehicle and multiple monitoring entries per case are permitted.
- Risk analysis stores accident count, violation count, and risk level.
- Journey rows store average speed, interval location, and inspection date.
- Sequences allocate appeal, payment, and case identifiers for live workflows.
- The teardown script removes only explicitly named project tables/sequences and is safe to rerun.
- Demo users have `NULL` password hashes; API tokens come only from environment configuration.

## Implemented versus simulated

Implemented in live mode: authenticated reads, owner scoping, appeal creation, supervisor review, pending payment requests, payment-state derivation, and restricted database inspection.

Still simulated or placeholder-only:

- AI detection/inference;
- real bank/MFS processing;
- evidence file storage and malware scanning;
- camera provisioning and user administration mutations;
- mapping/coordinate provider;
- cross-agency dispatch integrations.

## Security and rendering

The API uses bearer authentication, role checks, allowlisted origins, rate limiting, body limits, generic error responses, and restrictive headers. Database table names come from a fixed server allowlist. Dynamic frontend values pass through HTML escaping before template insertion; toast messages use `textContent`.

For a production implementation, replace static environment tokens with an identity provider, add token expiry/rotation, use a secrets manager, self-host or integrity-pin CDN assets, and deploy HTTPS plus centralized audit/monitoring.

## Verification record

- Node test suite covers authentication, authorization prerequisites, security headers, resource contracts, viewer exclusions, and validation helpers.
- Static checks cover JavaScript, JSON, HTML references, SQL teardown coverage, plate capacity, and seeded credential patterns.
- CI runs on pushes to `main` and pull requests.
- Browser smoke testing covers all role routes at desktop and mobile widths.
- Oracle execution remains environment-dependent; run the DDL and seed scripts against the target Oracle version before release.
