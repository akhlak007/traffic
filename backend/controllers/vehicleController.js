import oracledb from "oracledb";
import { execute, withTransaction } from "../config/database.js";
import { parseLimit, reportDatabaseError } from "../utils/http.js";
import { displayNameForUser } from "../utils/userName.js";

export async function getHealth(req, res) {
  try {
    await execute(`SELECT 1 AS "healthy" FROM DUAL`);
    return res.json({
      status: "ok",
      database: "connected",
      role: req.user.role,
      userId: req.user.userId,
      name: await displayNameForUser(req.user.userId),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Health check failed:", error.message);
    return res.status(503).json({ status: "error", database: "disconnected", timestamp: new Date().toISOString() });
  }
}

export async function getVehicles(req, res) {
  try {
    const ownerOnly = req.user.role === "owner";
    const limit = parseLimit(req.query.limit);
    const ownerWhere = ownerOnly ? `WHERE Vehicle_owner_id = :ownerId` : "";
    const sql = `
      SELECT * FROM (
        SELECT
          Licence_plate_no AS "vehicleId",
          Licence_plate_no AS "licensePlate",
          LOWER(Fitness_status) AS "fitnessStatus",
          Type AS "type",
          Colour AS "color",
          Colour AS "colour",
          Model AS "model",
          Vehicle_owner_id AS "ownerId"
        FROM VEHICLE
        ${ownerWhere}
        ORDER BY Licence_plate_no
      ) WHERE ROWNUM <= :limit`;
    const binds = ownerOnly ? { ownerId: req.user.ownerId, limit } : { limit };
    const result = await execute(sql, binds);
    return res.json(result.rows || []);
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch vehicles", error);
  }
}

export async function getVehicleStatus(req, res) {
  try {
    const ownerOnly = req.user.role === "owner";
    const limit = parseLimit(req.query.limit);
    const ownerWhere = ownerOnly ? `WHERE v.Vehicle_owner_id = :ownerId` : "";
    const sql = `
      SELECT * FROM (
        SELECT
          vs.ID AS "statusId",
          v.Licence_plate_no AS "vehicleId",
          v.Licence_plate_no AS "licensePlate",
          vs.Dmp_officer_id AS "dmpOfficerId",
          LOWER(vs.Status_type) AS "status",
          LOWER(vs.Status_type) AS "statusType",
          vs.Effective_date AS "effectiveDate",
          vs.Expiry_date AS "expiryDate"
        FROM VEHICLE_STATUS vs
        JOIN VEHICLE v ON v.ID = vs.Vehicle_id
        ${ownerWhere}
        ORDER BY vs.Effective_date DESC
      ) WHERE ROWNUM <= :limit`;
    const binds = ownerOnly ? { ownerId: req.user.ownerId, limit } : { limit };
    const result = await execute(sql, binds);
    return res.json(result.rows || []);
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch vehicle status records", error);
  }
}

export async function createVehicle(req, res) {
  const ownerId = Number(req.user?.ownerId);
  if (req.user?.role !== "owner" || !Number.isInteger(ownerId) || ownerId <= 0) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const licensePlate = String(req.body?.licensePlate || "").trim().toUpperCase();
  const fitnessStatus = String(req.body?.fitnessStatus || "Valid").trim();
  const type = String(req.body?.type || "").trim();
  const colour = String(req.body?.colour || req.body?.color || "").trim();
  const model = String(req.body?.model || "").trim();

  if (!/^[A-Z0-9-]{6,30}$/.test(licensePlate)) {
    return res.status(400).json({ error: "Licence plate must be 6-30 letters, numbers, or hyphens" });
  }
  if (!new Set(["Valid", "Expired"]).has(fitnessStatus)) {
    return res.status(400).json({ error: "Fitness status must be Valid or Expired" });
  }
  if (type.length < 2 || type.length > 30) return res.status(400).json({ error: "Vehicle type must be between 2 and 30 characters" });
  if (colour.length < 2 || colour.length > 30) return res.status(400).json({ error: "Colour must be between 2 and 30 characters" });
  if (model.length < 2 || model.length > 50) return res.status(400).json({ error: "Model must be between 2 and 50 characters" });

  try {
    const vehicle = await withTransaction(async (connection) => {
      const insert = await connection.execute(`
        INSERT INTO VEHICLE (Licence_plate_no, Fitness_status, Type, Colour, Model, Vehicle_owner_id)
        VALUES (:licensePlate, :fitnessStatus, :type, :colour, :model, :ownerId)
        RETURNING ID, Licence_plate_no INTO :vehicleId, :plate`,
      {
        licensePlate,
        fitnessStatus,
        type,
        colour,
        model,
        ownerId,
        vehicleId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        plate: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 }
      });
      return {
        vehicleId: insert.outBinds.plate[0],
        licensePlate: insert.outBinds.plate[0],
        fitnessStatus: fitnessStatus.toLowerCase(),
        type,
        colour,
        model,
        ownerId
      };
    });
    return res.status(201).json(vehicle);
  } catch (error) {
    if (Number(error.errorNum) === 1) return res.status(409).json({ error: "A vehicle with this licence plate already exists" });
    return reportDatabaseError(res, "Failed to register vehicle", error);
  }
}
