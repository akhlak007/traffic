import dotenv from "dotenv";
import { initializePool, closePool } from "./config/database.js";
import { createApp } from "./app.js";
import { validateAuthConfiguration } from "./middleware/auth.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    validateAuthConfiguration();
    if (!process.env.AUTH_SECRET || Buffer.byteLength(process.env.AUTH_SECRET, "utf8") < 32) {
      throw new Error("AUTH_SECRET must be set to at least 32 bytes for login");
    }
    await initializePool();
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`Backend server listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\nShutting down server...");
  await closePool();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nTerminating server...");
  await closePool();
  process.exit(0);
});

startServer();
