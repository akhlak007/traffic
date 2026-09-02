# Run commands

Copy these into a terminal from this repository. Git Bash, PowerShell, and Command Prompt all work. Use **two terminals** for the usual live setup: one for the API, one for the frontend.

Passwords for staff and owners live in Oracle `"USER".Password_hash`. Do not paste them into this file. `backend/.env` still holds Oracle connection settings, `AUTH_SECRET`, and API tokens.

---

## Everyday run (Live Oracle)

**Terminal 1 — API** (`http://localhost:5000`):

```bash
cd backend
npm start
```

Wait until you see `Backend server listening on http://localhost:5000`.

**Terminal 2 — frontend** (`http://127.0.0.1:4173`):

```bash
cd /c/Users/swaga/OneDrive/Desktop/ai_traffic
node dev-server.js
```

If you are already in the repo root, skip the `cd` and run:

```bash
node dev-server.js
```

Open **http://127.0.0.1:4173/**

Choose **Live Oracle API**, pick a role, then sign in with that role’s email and password. Staff and owners both use `"USER".Email` + `"USER".Password_hash` from Oracle (not `backend/.env`).

| Role | Email | Password |
|---|---|---|
| Administrator | `mushfiq.admin@traffic.demo` | `admin1` |
| Administrator | `muskan.admin@traffic.demo` | `admin2` |
| Traffic Officer | `indira.officer@traffic.demo` | `officer1` |
| Supervisor | `labiba.supervisor@traffic.demo` | `supervisor1` |
| DMP Officer | `jamila.dmp@traffic.demo` | `dmp1` |
| Faculty owners | `*.owner@traffic.demo` | local `backend/.faculty-demo-passwords.json` |

Auto-reload API while editing backend files:

```bash
cd backend
npm run dev
```

---

## Combined mode (one terminal)

The API also serves the static frontend:

```bash
cd backend
npm start
```

Open **http://localhost:5000/**

---

## Frontend only (offline demo)

No Oracle and no backend. From the repo root:

```bash
node dev-server.js
```

Or:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Open **http://127.0.0.1:4173/**, set **Offline demo data**, then pick a role.

---

## First-time setup

```bash
cd /c/Users/swaga/OneDrive/Desktop/ai_traffic
cd backend
npm install
cp .env.example .env
```

On PowerShell, copy the env file with:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env`: Oracle `DB_*`, `AUTH_SECRET` (32+ bytes), and five unique API tokens (32+ bytes each). Staff passwords live in Oracle `"USER".Password_hash`, not in `.env`.

Generate a random 32-byte hex string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Oracle scripts (once per schema)

Connect as the schema user in `DB_USER` (not `SYS`). Run in this order:

```text
database/01_create_tables.sql
database/02_insert_demo_data.sql
database/05_upgrade_evaluation_objects.sql
```

Example with SQL\*Plus (replace user, password, and PDB):

```bash
sqlplus USER/PASSWORD@localhost:1521/FREEPDB1
```

Then inside SQL\*Plus, from the repo root path:

```sql
@database/01_create_tables.sql
@database/02_insert_demo_data.sql
@database/05_upgrade_evaluation_objects.sql
```

Optional reset (drops project objects; do not run on a schema you still need):

```sql
@database/04_drop_tables.sql
```

`database/03_advanced_queries.sql` is coursework sample SQL. It is not required to start the app.

---

## Optional faculty owner seed

```bash
cd backend
cp .faculty-demo-passwords.example.json .faculty-demo-passwords.json
```

Edit the five passwords in `.faculty-demo-passwords.json`, then:

```bash
node scripts/seed-faculty-demo.mjs
```

---

## Checks and tests

From `backend`:

```bash
npm run check
npm test
```

Needs a running Oracle:

```bash
npm run test:oracle
```

Needs the frontend (and usually the API):

```bash
npm run test:browser
```

Audit production dependencies:

```bash
npm audit --omit=dev
```

---

## If a port is already in use

Windows Git Bash — stop whatever is on 5000 or 4173:

```bash
netstat -ano | grep -E '[:.]5000 .*LISTENING'
netstat -ano | grep -E '[:.]4173 .*LISTENING'
taskkill //PID <pid> //F
```

Then start the server again with `npm start` or `node dev-server.js`.
