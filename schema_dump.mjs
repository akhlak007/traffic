import { execute, initializePool, closePool } from "./backend/config/database.js";

async function run() {
  await initializePool();
  try {
    const sql = `
      SELECT table_name, column_name, data_type 
      FROM user_tab_columns 
      ORDER BY table_name, column_id
    `;
    const result = await execute(sql);
    const tables = {};
    for (const row of result.rows) {
      if (!tables[row.TABLE_NAME]) tables[row.TABLE_NAME] = [];
      tables[row.TABLE_NAME].push(row.COLUMN_NAME);
    }
    console.log(JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await closePool();
  }
}

run();
