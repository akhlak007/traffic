import { Router } from "express";
import { login, register } from "../controllers/authController.js";

export default function createAuthRoutes(environment = process.env) {
  const router = Router();
  router.post("/login", login(environment));
  router.post("/register", register());
  return router;
}
