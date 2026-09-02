import oracledb from "oracledb";
import { execute, withTransaction } from "../config/database.js";
import { signSession } from "../middleware/auth.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { formatUserName } from "../utils/userName.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function unwrapQuoted(value) {
  const text = String(value ?? "");
  const quote = text[0];
  if (text.length >= 2 && (quote === "\"" || quote === "'") && text[text.length - 1] === quote) {
    return text.slice(1, -1);
  }
  return text;
}

function validateOwnerRegistration(body) {
  const firstName = String(body?.firstName || "").trim();
  const lastName = String(body?.lastName || "").trim();
  const email = normalizeEmail(body?.email || body?.username);
  const address = String(body?.address || "").trim();
  const password = String(body?.password || "");
  const confirmPassword = String(body?.confirmPassword || "");

  if (firstName.length < 2 || firstName.length > 30 || lastName.length < 2 || lastName.length > 30) {
    return { error: "First and last name must be between 2 and 30 characters" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return { error: "A valid email address is required" };
  }
  if (address.length < 5 || address.length > 200) {
    return { error: "Address must be between 5 and 200 characters" };
  }
  if (password.length < 8 || password.length > 72) {
    return { error: "Password must be between 8 and 72 characters" };
  }
  if (password !== confirmPassword) {
    return { error: "Password confirmation does not match" };
  }
  return { firstName, lastName, email, address, password };
}

async function loginDatabaseUser(email, password) {
  const found = await execute(`
    SELECT u.ID AS "userId",
           u.Password_hash AS "passwordHash",
           u.First_name AS "firstName",
           u.Last_name AS "lastName",
           CASE
             WHEN vo.ID IS NOT NULL THEN 'owner'
             WHEN a.ID IS NOT NULL THEN 'admin'
             WHEN d.ID IS NOT NULL THEN 'dmp'
             WHEN t.ID IS NOT NULL AND t.Supervised_by IS NULL THEN 'supervisor'
             WHEN t.ID IS NOT NULL THEN 'officer'
           END AS "role"
    FROM "USER" u
    LEFT JOIN VEHICLE_OWNER vo ON vo.ID = u.ID
    LEFT JOIN ADMIN a ON a.ID = u.ID
    LEFT JOIN DMP_OFFICER d ON d.ID = u.ID
    LEFT JOIN TRAFFIC_OFFICER t ON t.ID = u.ID
    WHERE LOWER(u.Email) = :email`, { email });
  const row = found.rows?.[0];
  if (!row?.passwordHash || !row.role) return { invalid: true };
  const ok = await verifyPassword(password, row.passwordHash);
  if (!ok) return { invalid: true };
  const userId = Number(row.userId);
  return {
    role: row.role,
    userId,
    ownerId: row.role === "owner" ? userId : null,
    name: formatUserName(row)
  };
}

export function login(environment = process.env) {
  return async (req, res) => {
    const username = String(req.body?.username || req.body?.email || "").trim();
    const password = unwrapQuoted(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    if (!environment.AUTH_SECRET || Buffer.byteLength(environment.AUTH_SECRET, "utf8") < 32) {
      return res.status(503).json({ error: "Login is not configured" });
    }

    try {
      const account = await loginDatabaseUser(normalizeEmail(username), password);
      if (account.invalid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      const token = signSession({
        role: account.role,
        userId: account.userId,
        ownerId: account.ownerId
      }, environment.AUTH_SECRET);
      return res.json({
        token,
        role: account.role,
        userId: account.userId,
        name: account.name
      });
    } catch {
      return res.status(503).json({ error: "Login is not available" });
    }
  };
}

export function register() {
  return async (req, res) => {
    const validated = validateOwnerRegistration(req.body);
    if (validated.error) return res.status(400).json({ error: validated.error });

    try {
      const created = await withTransaction(async (connection) => {
        const existing = await connection.execute(
          `SELECT 1 FROM "USER" WHERE LOWER(Email) = :email`,
          { email: validated.email }
        );
        if (existing.rows?.length) {
          const error = new Error("An account with this email already exists");
          error.status = 409;
          throw error;
        }

        const passwordHash = await hashPassword(validated.password);
        const userInsert = await connection.execute(`
          INSERT INTO "USER" (First_name, Last_name, Email, Password_hash)
          VALUES (:firstName, :lastName, :email, :passwordHash)
          RETURNING ID INTO :userId`,
        {
          firstName: validated.firstName,
          lastName: validated.lastName,
          email: validated.email,
          passwordHash,
          userId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        });
        const userId = userInsert.outBinds.userId[0];
        await connection.execute(
          `INSERT INTO VEHICLE_OWNER (ID, Address) VALUES (:userId, :address)`,
          { userId, address: validated.address }
        );
        return { userId };
      });
      return res.status(201).json({
        userId: created.userId,
        role: "owner",
        message: "Owner account created. Sign in with your email and password."
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      if (Number(error.errorNum) === 1) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }
      return res.status(500).json({ error: "Failed to create owner account" });
    }
  };
}
