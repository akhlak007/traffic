import { execute } from "../config/database.js";

export function formatUserName(row) {
  const parts = [row?.firstName, row?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export async function displayNameForUser(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    const result = await execute(
      `SELECT First_name AS "firstName", Last_name AS "lastName" FROM "USER" WHERE ID = :userId`,
      { userId: id }
    );
    return formatUserName(result.rows?.[0]);
  } catch {
    return null;
  }
}
