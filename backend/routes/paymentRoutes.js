import { Router } from "express";
import { createPayment, getPayments } from "../controllers/paymentController.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

router.post("/payments", authorize("owner"), createPayment);
router.get("/payments", authorize("owner"), getPayments);

export default router;
