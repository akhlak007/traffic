# Running Traffic AI Dhaka on a New Windows Laptop

For the current clone/setup path (email/password login, owner registration, `"USER".Password_hash`, and optional faculty seed), start with **Fresh Clone Setup** in [README.md](README.md). This file still has extra Windows/Oracle detail; some older token-paste login wording below is outdated.

The live application has four parts:

```text
Browser -> Express frontend and API -> Oracle Database
               port 5000             port 1521 by default
```

Express now serves both the static frontend and `/api` routes. A separate Python web server is needed only when running the mock-data-only version.

## 1. What Git does and does not contain

The repository contains:

- the frontend HTML, CSS, JavaScript, and mock JSON;
- the Express backend;
- the Oracle schema, seed data, advanced queries, and reset script;
- automated checks and tests.

The repository intentionally does **not** contain:

- `backend/.env`;
- the Oracle schema password;
- the five role tokens;
- Oracle database files or locally changed database rows.

On a new laptop, recreate the demo database from the SQL scripts and create a new `backend/.env`. Do not copy secrets into Git.

## 2. Prerequisites

Install these components before cloning the project:

1. **Git for Windows**: <https://git-scm.com/download/win>
2. **Node.js LTS 20 or newer**: <https://nodejs.org/en/download>
3. **Oracle Database**, using one of the following approaches:
   - native Oracle AI Database Free for Windows: <https://www.oracle.com/database/free/get-started/>; or
   - the official Oracle Database Free container if Docker Desktop is already available.
4. A current browser such as Chrome, Edge, or Firefox.

The project uses the Thin mode of `node-oracledb`, so Oracle Instant Client is not required.

Check Git and Node from PowerShell:

```powershell
git --version
node --version
npm --version
```

The Node version must be at least 20. Prefer a current LTS release.

### Important Windows note

Oracle's current native Database Free installer does not support Windows Home Edition. On an unsupported Windows edition, use the official Oracle container through Docker Desktop/WSL2, or run Oracle on another reachable machine. The application code does not need to change as long as `backend/.env` points to the correct host, listener port, and PDB service.

## 3. Clone the repository

Choose a normal development directory and run:

```powershell
git clone https://github.com/akhlak007/ai_traffic.git
Set-Location ai_traffic
git switch main
git pull --ff-only origin main
```

Confirm that the checkout is clean:

```powershell
git status --short
```

No output means the working tree is clean.

## 4. Install and prepare Oracle

Use either Option A or Option B. Do not configure both on the same listener port.

### Option A: Native Oracle Database Free on Windows

Install Oracle Database Free using the official installer. Accept the default listener port unless another Oracle installation already uses it. Record the password created for `SYS`, `SYSTEM`, and `PDBADMIN`.

The usual Database Free values are:

```text
Host: localhost
Port: 1521
PDB service: FREEPDB1
```

Oracle XE 21c normally uses `XEPDB1`. Always use the connection information displayed by the installer or `lsnrctl status`; do not guess the service name.

Open a new PowerShell window and connect as a local database administrator:

```powershell
sqlplus / as sysdba
```

At the SQL prompt, switch to the pluggable database and create the project schema:

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE USER SMART_TRAFFIC IDENTIFIED BY "REPLACE_WITH_A_STRONG_DB_PASSWORD";
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO SMART_TRAFFIC;
ALTER USER SMART_TRAFFIC QUOTA UNLIMITED ON USERS;

EXIT;
```

If using Oracle XE, replace `FREEPDB1` with `XEPDB1`.

### Option B: Oracle Database Free in Docker Desktop

Use this option when the native installer is not supported. Docker Desktop must use Linux containers and should have at least 4 GB of memory available.

First accept any required Oracle Container Registry terms, then pull and start the official image:

```powershell
docker pull container-registry.oracle.com/database/free:latest
docker volume create traffic-oracle-data
docker run -d --name traffic-oracle --restart unless-stopped --shm-size=1g -p 1521:1521 -e ORACLE_PWD=REPLACE_WITH_A_STRONG_ADMIN_PASSWORD -v traffic-oracle-data:/opt/oracle/oradata container-registry.oracle.com/database/free:latest
```

The volume preserves the database when the container restarts. Do not delete `traffic-oracle-data` unless the database is intentionally being erased.

Watch the initial database creation:

```powershell
docker logs -f traffic-oracle
```

Wait until the logs report that the database is ready, then press `Ctrl+C`; this stops log-following, not the container.

Create the project schema inside `FREEPDB1`:

```powershell
docker exec -it traffic-oracle sqlplus / as sysdba
```

At the SQL prompt:

```sql
ALTER SESSION SET CONTAINER = FREEPDB1;

CREATE USER SMART_TRAFFIC IDENTIFIED BY "REPLACE_WITH_A_STRONG_DB_PASSWORD";
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE TO SMART_TRAFFIC;
ALTER USER SMART_TRAFFIC QUOTA UNLIMITED ON USERS;

EXIT;
```

## 5. Create the tables and load demo data

The scripts must be executed in this order as `SMART_TRAFFIC`:

1. `database/01_create_tables.sql`
2. `database/02_insert_demo_data.sql`

`database/03_advanced_queries.sql` contains the five reporting queries and is not required to start the application. `database/04_drop_tables.sql` is an intentional reset script.

### Native Oracle

From the repository root, start SQL*Plus without putting the password into shell history:

```powershell
sqlplus /nolog
```

At the SQL prompt:

```sql
CONNECT SMART_TRAFFIC/"REPLACE_WITH_THE_SCHEMA_PASSWORD"@localhost:1521/FREEPDB1
@database/01_create_tables.sql
@database/02_insert_demo_data.sql
```

Use `XEPDB1` instead of `FREEPDB1` when applicable. If the listener uses a non-default port, replace `1521` with that port.

### Docker Oracle

Copy the scripts into the running container:

```powershell
docker cp database/01_create_tables.sql traffic-oracle:/tmp/01_create_tables.sql
docker cp database/02_insert_demo_data.sql traffic-oracle:/tmp/02_insert_demo_data.sql
```

Open SQL*Plus in the container:

```powershell
docker exec -it traffic-oracle sqlplus /nolog
```

Then run:

```sql
CONNECT SMART_TRAFFIC/"REPLACE_WITH_THE_SCHEMA_PASSWORD"@FREEPDB1
@/tmp/01_create_tables.sql
@/tmp/02_insert_demo_data.sql
```

### Verify the database

Before leaving SQL*Plus, verify the expected baseline:

```sql
SELECT COUNT(*) AS TABLE_COUNT FROM USER_TABLES;
SELECT COUNT(*) AS OBSOLETE_SEQUENCE_COUNT
FROM USER_SEQUENCES
WHERE SEQUENCE_NAME IN ('APPEAL_SEQ', 'PAYMENT_SEQ', 'CASE_RECORD_SEQ');
SELECT COUNT(*) AS USER_COUNT FROM "USER";
SELECT COUNT(*) AS VEHICLE_COUNT FROM VEHICLE;
```

Expected results:

```text
TABLE_COUNT:    38
OBSOLETE_SEQUENCE_COUNT: 0
USER_COUNT:     22
VEHICLE_COUNT:  5
```

Exit SQL*Plus:

```sql
EXIT;
```

### Resetting a partially loaded database

If table creation or seeding was interrupted, connect as `SMART_TRAFFIC` from the repository root and run:

```sql
@database/04_drop_tables.sql
@database/01_create_tables.sql
@database/02_insert_demo_data.sql
```

The drop script permanently removes this project's tables and their data. Run it only in the `SMART_TRAFFIC` schema and only when a full reset is intended.

For the Docker option, copy `04_drop_tables.sql` into `/tmp` just like the first two scripts and use the `/tmp/...` paths inside SQL*Plus.

## 6. Configure the backend

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Open `backend/.env` in a text editor and configure the database:

```dotenv
PORT=5000
DB_USER=SMART_TRAFFIC
DB_PASSWORD=REPLACE_WITH_THE_SCHEMA_PASSWORD
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE=FREEPDB1
CORS_ORIGINS=http://127.0.0.1:4173,http://localhost:4173
RATE_LIMIT_PER_MINUTE=120
```

For Oracle XE, use `DB_SERVICE=XEPDB1`. Use the actual listener port if it is not `1521`.

Generate five independent role tokens. This command prints five different 64-character tokens:

```powershell
1..5 | ForEach-Object { node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))" }
```

Copy one different generated value into each setting:

```dotenv
ADMIN_API_TOKEN=REPLACE_WITH_TOKEN_1
OFFICER_API_TOKEN=REPLACE_WITH_TOKEN_2
SUPERVISOR_API_TOKEN=REPLACE_WITH_TOKEN_3
OWNER_API_TOKEN=REPLACE_WITH_TOKEN_4
DMP_API_TOKEN=REPLACE_WITH_TOKEN_5

ADMIN_USER_ID=1
TRAFFIC_OFFICER_USER_ID=7
SUPERVISOR_USER_ID=6
OWNER_USER_ID=17
DMP_OFFICER_USER_ID=12
```

The IDs correspond to rows in the supplied seed data. Do not change them unless the database users are changed too.

`backend/.env` is ignored by Git. Never commit or send the database password or the complete `.env` file. Group members need only the token for the role they are testing.

## 7. Install dependencies and run checks

From the repository root:

```powershell
Set-Location backend
npm ci
npm run check
npm test
npm audit --omit=dev
```

The expected baseline is:

- static checks pass;
- 9 tests pass;
- the checker reports 38 Oracle tables;
- npm reports no known production dependency vulnerabilities.

Return to the repository root when needed:

```powershell
Set-Location ..
```

## 8. Start the complete live application

Make sure Oracle is running, then start Express:

```powershell
Set-Location backend
npm start
```

Expected startup messages include a successful Oracle connection pool and:

```text
Backend server listening on http://localhost:5000
```

Open:

<http://localhost:5000/>

On the login screen:

1. choose the required role;
2. select **Live Oracle API**;
3. paste the matching role token from `backend/.env`;
4. enter the workspace.

Leave this terminal open while using the application. Press `Ctrl+C` for a graceful shutdown.

## 9. Verify the running application

In another PowerShell window, move to the repository root and check the page on the laptop:

```powershell
Set-Location C:\path\to\ai_traffic
(Invoke-WebRequest http://localhost:5000/ -UseBasicParsing).StatusCode
```

Expected result: `200`.

Test an authenticated Oracle-backed endpoint without displaying the token:

```powershell
$tokenLine = Get-Content backend/.env | Where-Object { $_ -like 'ADMIN_API_TOKEN=*' } | Select-Object -First 1
$adminToken = ($tokenLine -split '=', 2)[1].Trim()
$response = Invoke-RestMethod http://localhost:5000/api/vehicles -Headers @{ Authorization = "Bearer $adminToken" }
$response.data.Count
```

Expected result with the original seed data: `5`.

### Optional access from another laptop on the same trusted network

Find the server laptop's local IPv4 address:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object InterfaceAlias,IPAddress
```

After allowing TCP port 5000 through Windows Firewall on the private network profile, another group laptop can open:

```text
http://SERVER_LAN_IP:5000/
```

The frontend and API remain on the same origin. Do not configure router port forwarding for port 5000, and never expose Oracle port 1521 to the internet.

## 10. Run the mock-only version without Oracle

Mock mode is useful for UI demonstrations when Oracle or Node is unavailable. From the repository root:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/> and leave **Demo data** selected. Mock changes do not persist and do not query Oracle.

## 11. Daily startup and shutdown

### Native Oracle startup check

Oracle normally installs its Windows services with automatic startup. Check them with:

```powershell
Get-Service | Where-Object { $_.Name -like 'OracleService*' -or $_.Name -like '*TNSListener*' }
```

If the database or listener is stopped, open PowerShell as Administrator and start the exact service name reported on the laptop:

```powershell
Start-Service -Name OracleServiceFREE
```

The name may instead contain `XE`. Do not copy a service name without checking it first.

### Docker Oracle startup check

Docker Desktop must be running. Check and start the database container with:

```powershell
docker ps -a --filter name=traffic-oracle
docker start traffic-oracle
```

Because the container was created with `--restart unless-stopped`, it normally returns after Docker Desktop starts.

### Application startup

After Oracle is ready:

```powershell
Set-Location C:\path\to\ai_traffic\backend
npm start
```

Replace the example path with the real repository location.

### Shutdown

1. Press `Ctrl+C` in the Node terminal.
2. Native Oracle can remain running as a Windows service.
3. For Docker, optionally run `docker stop traffic-oracle` before shutting down the laptop.

## 12. Start Node automatically after sign-in

For a demo laptop that should recover after a reboot, use Windows Task Scheduler:

1. Open **Task Scheduler** and select **Create Task**.
2. Name it `Traffic AI Backend`.
3. Add an **At log on** trigger.
4. Add a **Start a program** action.
5. Set **Program/script** to the full path of `node.exe`, normally `C:\Program Files\nodejs\node.exe`.
6. Set **Add arguments** to `server.js`.
7. Set **Start in** to the absolute `backend` directory, for example `C:\Projects\ai_traffic\backend`.
8. Under **Settings**, enable restart on failure.
9. Ensure Oracle starts before the task runs. A delay of 30-60 seconds after logon is useful on slower laptops.

Test the task manually from Task Scheduler and then verify <http://localhost:5000/>.

To keep the application reachable, the laptop must remain powered on and awake. In Windows power settings, prevent sleep while plugged in. Closing the lid commonly suspends the database and Node process unless the power policy is changed.

## 13. Pull future GitHub updates

Stop the Node process before updating. From the repository root:

```powershell
git status --short
git pull --ff-only origin main
Set-Location backend
npm ci
npm run check
npm test
npm start
```

If `git status --short` shows local modifications, review and preserve them before pulling. Never use a destructive reset on files that have not been backed up.

Database scripts are not automatically rerun after a Git update. Read the commit notes before applying schema changes. A full reset deletes mutations such as newly submitted appeals or payment requests.

## 14. Backup and transfer notes

For the supplied demo baseline, the safest backup is already in Git:

- `database/01_create_tables.sql` recreates the objects;
- `database/02_insert_demo_data.sql` recreates the seed rows;
- `database/03_advanced_queries.sql` contains the reporting queries.

Keep a secure separate copy of `backend/.env`, or regenerate its tokens on the new laptop.

If the database contains important changes made after seeding, use Oracle Data Pump or another Oracle-supported export before moving laptops. Copying only the Git repository will not copy those database changes.

## 15. Troubleshooting

### `ORA-12541: TNS:no listener` or `DPY-6005`

The backend cannot reach the listener.

```powershell
lsnrctl status
Test-NetConnection localhost -Port 1521
```

Start the Oracle listener/service, start the Docker container, or correct `DB_HOST` and `DB_PORT`.

### `ORA-12514` or service not registered

`DB_SERVICE` is wrong, or the PDB has not opened. Check `lsnrctl status` for the registered service. Typical values are `FREEPDB1` for Database Free and `XEPDB1` for XE.

### `ORA-01017: invalid username/password`

Check `DB_USER` and `DB_PASSWORD` in `backend/.env`. Confirm that the user was created inside the PDB, not only in `CDB$ROOT`.

### Backend reports invalid authentication configuration

All five token variables must be present, unique, and at least 32 bytes. Regenerate missing tokens and restart Node.

### Login page works but live screens return `401`

Select **Live Oracle API** and paste the token matching the selected role. Tokens are case-sensitive and are cleared when the tab logs out or closes.

### Live screens return `500`

Read the Node terminal for the first error. Confirm the tables and seed data exist under `SMART_TRAFFIC`, and run the SQL verification queries from Section 5.

### Port 5000 is already in use

Identify the process before stopping anything:

```powershell
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess
```

If another known application owns the port, stop that application or set another `PORT` value in `backend/.env`. Open the browser using that same new port.

### Oracle takes time to start

The backend creates its Oracle pool during startup and exits if Oracle is unavailable. Wait until the PDB is ready, then run `npm start` again. Docker database creation takes considerably longer on the first run than on later restarts.

## 16. Security boundaries for the group demo

- Keep `backend/.env` outside Git.
- Share only the role token each group member needs.
- Do not expose Oracle listener port `1521` directly to the public internet.
- Do not store real identity, vehicle, evidence, or payment data in this coursework database.
- The payment workflow records a pending demo request; it does not contact a bank or mobile financial service.
- Use the local firewall and a trusted network when other laptops access the server.

## Final readiness checklist

- [ ] Git, Node.js, and Oracle are installed.
- [ ] `main` is cloned and clean.
- [ ] Oracle listener and PDB are running.
- [ ] `SMART_TRAFFIC` exists in the correct PDB.
- [ ] 38 tables, no obsolete named sequences, 22 users, and 5 vehicles are present.
- [ ] `backend/.env` contains the correct Oracle settings and five unique tokens.
- [ ] `npm ci`, `npm run check`, `npm test`, and `npm audit --omit=dev` pass.
- [ ] <http://localhost:5000/> returns HTTP 200.
- [ ] `/api/vehicles` returns five seeded vehicles with the admin token.
- [ ] Sleep is disabled while the demo laptop is expected to remain reachable.
