import express from "express";
import cors from "cors";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import appealRoutes from "./routes/appealRoutes.js";
import databaseRoutes from "./routes/databaseRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import evaluationRoutes from "./routes/evaluationRoutes.js";
import createAuthRoutes from "./routes/authRoutes.js";
import { authenticationMiddleware } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";

export function createApp(environment = process.env) {
  const app = express();
  const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const allowedOrigins = new Set(
    (environment.CORS_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Authorization", "Content-Type"]
  }));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", rateLimit({ max: Number(environment.RATE_LIMIT_PER_MINUTE || 120) }));
  app.use("/api/auth", createAuthRoutes(environment));
  app.use("/api", authenticationMiddleware(environment));

  app.use("/api", vehicleRoutes);
  app.use("/api", noticeRoutes);
  app.use("/api", appealRoutes);
  app.use("/api", paymentRoutes);
  app.use("/api", resourceRoutes);
  app.use("/api", evaluationRoutes);
  app.use("/api/database", databaseRoutes);

  for (const directory of ["assets", "css", "js", "mock-data", "pages"]) {
    app.use(`/${directory}`, express.static(join(projectRoot, directory), {
      dotfiles: "deny",
      index: false
    }));
  }
  app.get(["/", "/index.html"], (req, res) => res.sendFile(join(projectRoot, "index.html")));
  app.get("/register.html", (req, res) => res.sendFile(join(projectRoot, "register.html")));
  app.get("/404.html", (req, res) => res.sendFile(join(projectRoot, "404.html")));

  app.use((req, res) => res.status(404).json({ error: "Route not found" }));
  app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack || err.message);
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
