import { Router } from "express";
import { createAppeal, getAppeals, reviewAppeal } from "../controllers/appealController.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

router.get("/appeals", authorize("admin", "officer", "supervisor", "owner"), getAppeals);
router.post("/appeals", authorize("owner"), createAppeal);
router.patch("/appeals/:appealId/review", authorize("supervisor"), reviewAppeal);

export default router;
