import { execute } from "../config/database.js";
import { reportDatabaseError } from "../utils/http.js";

// The viewer is intentionally limited to operational, non-credential tables.
export const VIEWABLE_TABLES = new Set([
  "ALERT_EVENT", "APPEAL", "CAMERA", "CAMERA_EVENT", "CASE_RECORD",
  "CONGESTION_EVENT", "EVIDENCE", "IDENTIFIED_IN", "INVOLVED_IN",
  "NOTICE", "RISK_ANALYSIS", "ROAD_DEFECT_EVENT",
  "ROAD_SEGMENT", "SUSPICIOUS_VEHICLE_EVENT", "VEHICLE", "VEHICLE_JOURNEY",
  "VEHICLE_STATUS", "VIOLATION_EVENT", "ZONE"
]);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatOracleDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return value;
  const day = pad2(value.getDate());
  const month = pad2(value.getMonth() + 1);
  const year = value.getFullYear();
  const hours = pad2(value.getHours());
  const minutes = pad2(value.getMinutes());
  const seconds = pad2(value.getSeconds());
  if (hours === "00" && minutes === "00" && seconds === "00") {
    return `${day}-${month}-${year}`;
  }
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
}

function serializeViewerRow(row) {
  const next = {};
  for (const [key, value] of Object.entries(row || {})) {
    next[key] = formatOracleDate(value);
  }
  return next;
}

export async function getTables(req, res) {
  try {
    const result = await execute(`SELECT table_name AS "tableName" FROM user_tables ORDER BY table_name`);
    const tables = (result.rows || [])
      .map((row) => row.tableName)
      .filter((tableName) => VIEWABLE_TABLES.has(tableName));
    return res.json(tables);
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch tables", error);
  }
}

export async function getTableData(req, res) {
  const tableName = String(req.params.tableName || "").toUpperCase();
  if (!VIEWABLE_TABLES.has(tableName)) {
    return res.status(404).json({ error: "Table not found or not viewable" });
  }

  try {
    const colsResult = await execute(
      `SELECT column_name AS "columnName" FROM user_tab_columns WHERE table_name = :name ORDER BY column_id`,
      { name: tableName }
    );
    const columns = (colsResult.rows || []).map((row) => row.columnName);
    if (!columns.length) return res.status(404).json({ error: "Table not found" });

    // tableName is selected exclusively from the fixed server-side allowlist.
    const dataResult = await execute(`SELECT * FROM ${tableName} WHERE ROWNUM <= 100`);
    const rows = (dataResult.rows || []).map(serializeViewerRow);
    return res.json({ tableName, columns, rows });
  } catch (error) {
    return reportDatabaseError(res, "Failed to fetch table data", error);
  }
}
