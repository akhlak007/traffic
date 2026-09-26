# Traffic AI Dhaka

Coursework prototype for an AI-assisted traffic violation and traffic management system. It includes a multi-role frontend, an Express API, an Oracle schema, demo data, and automated checks.

🌐 **Live Demo (GitHub Pages):** [https://akhlak007.github.io/traffic/](https://akhlak007.github.io/traffic/) *(Select "Offline demo data" for instant static exploration)*

This repository models AI-generated events. It does not contain a trained model. Do not use it for real law-enforcement, identity, evidence, or payment data.

For extra Windows/Oracle notes see [NEW_LAPTOP_SETUP.md](NEW_LAPTOP_SETUP.md). For architecture diagrams see [ARCHITECTURE.md](ARCHITECTURE.md). The **Fresh Clone Setup** section below is the current handoff guide.

## Stakeholder Consultation: Dhaka Metropolitan Police (DMP) Traffic Division

<p align="center">
  <img src="assets/reference/dmp_traffic_division_visit.jpg" alt="Visiting Dhaka Metropolitan Police (DMP) Traffic Division" width="850">
  <br>
  <em>Team visit and consultation at Dhaka Metropolitan Police (DMP) Traffic Division</em>
</p>

To ground our system design and business logic in real-world traffic enforcement practices, the team visited the **Dhaka Metropolitan Police (DMP) Traffic Division**. The consultation helped shape our operational requirements, including:
- **DMP Officer Workflows:** Rapid on-field and central vehicle lookup, violation history tracking, and active notice verification.
- **Traffic Violation Lifecycle:** Real-time AI detection, officer review, notice issuance, and structured dispute/appeal hierarchies.
- **Multi-Role Coordination:** Seamless operational handoff between traffic field officers, DMP division supervisors, and vehicle owners.

## Quick start: mock data only

The default **Demo data** mode uses JSON files in `mock-data/` and does not need Node.js or Oracle.

- **Online directly:** [https://akhlak007.github.io/traffic/](https://akhlak007.github.io/traffic/)
- **Or locally:**

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Or, from the repository root:

```powershell
node dev-server.js
```

Open `http://127.0.0.1:4173/`, keep **Demo data** selected, and choose a role.

## Fresh Clone Setup

Use this section on a new computer after `git clone`.

### 1. Prerequisites

- Git
- Node.js **20 or newer** (22 is what CI uses)
- Oracle Database Free / XE (or another local Oracle with a PDB such as `FREEPDB1`)
- A SQL client (SQL Developer, SQLcl, or `sqlplus`)
- A browser
- Optional: Python, only if you prefer `python -m http.server` instead of `node dev-server.js`

The frontend is static HTML/CSS/JS. There is no React/Vite build step.

### 2. Clone the repository

```powershell
git clone <repository-url>
cd ai_traffic
```

### 3. Backend dependencies

```powershell
cd backend
npm install
```

`package-lock.json` is committed. `npm ci` also works if you want a clean lockfile install.

### 4. Environment file

```powershell
Copy-Item .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Edit `backend/.env` and set:

- `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_SERVICE` for **your** Oracle schema
- `AUTH_SECRET` to a local random value of at least 32 bytes
- five unique API tokens, each at least 32 bytes

Generate random values:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit `backend/.env`.

The app builds the Oracle connect string as `DB_HOST:DB_PORT/DB_SERVICE` (for example `localhost:1521/FREEPDB1`). There is no separate `DB_CONNECT_STRING` variable.

Staff and owner logins both read `"USER".Email` and `"USER".Password_hash`. API role tokens in `.env` are machine credentials, not person passwords.

After a fresh demo insert and `node scripts/seed-faculty-demo.mjs`, these user IDs are expected:

| Role | Email | User ID | Password |
|---|---|---|---|
| Admin | `mushfiq.admin@traffic.demo` | 1 | `admin1` |
| Admin | `muskan.admin@traffic.demo` | 2 | `admin2` |
| Supervisor | `labiba.supervisor@traffic.demo` | 6 | `supervisor1` |
| Traffic officer | `indira.officer@traffic.demo` | 7 | `officer1` |
| DMP officer | `jamila.dmp@traffic.demo` | 12 | `dmp1` |
| Faculty owners | `*.owner@traffic.demo` | 17-21 | local password JSON |

Supervisor login is traffic officer 6 (`Supervised_by` is null). Officer login is a supervised officer (ID 7).

### 5. Oracle database setup

Connect as the project schema user (the user in `DB_USER`), not as `SYS` for the table scripts.

Run in this order:

1. `database/01_create_tables.sql` — schema, including `"USER".Password_hash`
2. `database/02_insert_demo_data.sql` — base users, zones, cameras, vehicles, notices, payments, appeals
3. `database/05_upgrade_evaluation_objects.sql` — procedures, views, ADT/object type, PL/SQL used by reports

Only if you are resetting an empty/dev schema and understand it will drop project objects:

- `database/04_drop_tables.sql`

Do **not** run `04_drop_tables.sql` against a database you still need.

`database/03_advanced_queries.sql` is coursework sample SQL. It is **not** required to start the app and may not match the current column names.

A fresh run of `02_insert_demo_data.sql` creates Arif as USER/owner **17**, notices **1–5**, and the original demo payments/appeals. It does **not** create faculty owners, Payment 21, or Notices 6–7. Those last items are local test rows and will not appear on a teammate machine unless they seed or create them.

### 6. Optional faculty demo seed

This is optional. The app runs without it. Registration still works without it.

1. Copy `backend/.faculty-demo-passwords.example.json` to `backend/.faculty-demo-passwords.json`
2. Replace each `replace-this-locally` value with a password you choose
3. From `backend`:

```powershell
node scripts/seed-faculty-demo.mjs
```

That script:

- creates five owners by email (`*.owner@traffic.demo`)
- generates USER / VEHICLE_OWNER IDs from Oracle (it does not require IDs 221–225)
- stores only scrypt hashes in `"USER".Password_hash`
- looks up cameras and a traffic officer from the demo schema

Keep `backend/.faculty-demo-passwords.json` local. It is gitignored. Do not put real passwords in Git.

If an email already exists, that owner is skipped.

### 7. Start the backend

From `backend`:

```powershell
npm start
```

You should see it listening on `http://localhost:5000`.

### 8. Start the frontend

Recommended split setup (matches CORS defaults):

From the **repository root**, in a second terminal:

```powershell
node dev-server.js
```

Frontend: `http://127.0.0.1:4173`  
Backend API: `http://localhost:5000/api`

When the frontend is on port 4173, the browser code calls `http://localhost:5000/api`. Keep `CORS_ORIGINS` as in `.env.example`.

You can instead open `http://localhost:5000/` and use the API and static files from the same origin.

### 9. Open the app

- Split setup: `http://127.0.0.1:4173/index.html`
- Combined: `http://localhost:5000/index.html`

Choose **Live Oracle API**, then sign in with email and password (not a pasted API token).

### 10. Register a normal owner

Open `register.html` (linked from the login page).

Required fields: first name, last name, email, address, password, confirm password.

This calls `POST /api/auth/register` and, in one transaction, creates:

`USER` (including `Password_hash`) → same ID `VEHICLE_OWNER`

A new owner does not need a `.env` mapping, the faculty seed, or a `@traffic.demo` email.

### 11. Login

On the login page, use that email and password. The session is an owner session (`role=owner`, `userId` and `ownerId` from Oracle).

### 12. Add a vehicle

Open **Vehicles**, submit the form. The vehicle is stored with `Vehicle_owner_id` from the authenticated session, not from the request body.

### 13. Owner Pay / Appeal rules

These rules are generic for every owner:

| Notice state | Pay | Appeal |
|---|---|---|
| Unpaid, no appeal | Yes | Yes |
| Payment pending | No | No |
| Payment successful | No | No |
| Appeal pending / under review | No | No |
| Appeal approved | No | No |
| Appeal rejected | Yes, if otherwise unpaid | No (one appeal per notice) |

### 14. Faculty demo accounts (if you ran the seed)

Log in with each `*.owner@traffic.demo` email and the password you put in the local JSON file. Expected starting states:

- Tanisha: unpaid notices, Pay and Appeal available
- Fahim: one pending payment (Pay/Appeal off) and one unpaid eligible notice
- Zubaer: two successful payments (MFS and bank) plus one unpaid notice
- Swagata: current notices paid
- Akhlak: one pending appeal plus one unpaid eligible notice

IDs will differ from another machine. Use email, not a copied ID.

### 15. Traffic Officer and Supervisor

Log in with the faculty staff emails from the table above. Both accounts are `"USER"` rows with password hashes.

- Traffic Officer → **Appeals** is read-only
- Supervisor → **Appeals** can Approved / Rejected

Do not share real passwords in the repository or in chat logs you might commit.

### 16. Common setup errors

| Symptom | Likely cause |
|---|---|
| `Failed to start server` / Oracle connect error | Wrong `DB_USER` / `DB_PASSWORD` / host |
| `ORA-12514` or similar | `DB_SERVICE` is not `FREEPDB1` (or your PDB name) |
| Login page cannot reach API | Backend not running on port 5000 |
| CORS error in the browser | Frontend origin not listed in `CORS_ORIGINS` |
| Frontend on the wrong port | Use `4173` for `dev-server.js`, or `5000` for combined mode |
| `Login is not configured` | Missing/short `AUTH_SECRET` |
| `Missing API authentication settings` | Empty role tokens in `.env` |
| `Cannot find module` | Run `npm install` inside `backend` |
| Faculty seed fails on cameras/officer | Run `02_insert_demo_data.sql` first |
| Register works but staff login fails | Faculty seed has not written `"USER".Password_hash` for staff |

## Security model

- `/api/auth/login` and `/api/auth/register` are public.
- Other `/api` routes require a bearer session (or a role API token from `.env`).
- Owner vehicles, notices, payments, and appeals are filtered by `req.user.ownerId`.
- CORS defaults to `http://127.0.0.1:4173` and `http://localhost:4173`.
- The admin database viewer excludes `USER` (including `Password_hash`), `PHONE`, `PAYMENT`, `PAYS`, `BY_BANK`, and `BY_MFS`.

## Verification

```powershell
cd backend
npm run check
npm test
```

`npm test` does not need Oracle. `npm run test:oracle` and `npm run test:browser` need a running database and/or frontend and are not part of the default CI job.

## What is and is not in Git

Included: application source, schema, base demo SQL, faculty seed script, `.env.example`, placeholder faculty password example, tests.

Not included: `backend/.env`, `backend/.faculty-demo-passwords.json`, `node_modules`, Oracle data files, local manual-test rows.
