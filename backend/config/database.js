import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

// Ensure node-oracledb returns query results as JavaScript objects with column aliases as keys
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let pool;

export async function initializePool() {
  try {
    const connectString = `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`;
    pool = await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
      poolTimeout: 60
    });
    console.log(`✓ Oracle connection pool created successfully (Thin mode) -> ${connectString}`);
  } catch (error) {
    console.error("❌ Failed to initialize Oracle connection pool:", error.message);
    throw error;
  }
}

export async function closePool() {
  if (pool) {
    try {
      await pool.close(10);
      console.log("Oracle connection pool closed.");
    } catch (error) {
      console.error("Error closing connection pool:", error);
    }
  }
}

export async function execute(sql, binds = [], options = {}) {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, options);
    return result;
  } catch (error) {
    console.error(`Database Query Error [${sql}]:`, error.message);
    throw error;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error releasing connection back to pool:", err);
      }
    }
  }
}

export async function withTransaction(callback) {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    if (connection) await connection.rollback();
    throw error;
  } finally {
    if (connection) await connection.close();
  }
}
