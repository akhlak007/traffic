import { Router } from "express";
import { createVehicle, getHealth, getVehicles, getVehicleStatus } from "../controllers/vehicleController.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

router.get("/health", getHealth);
router.get("/vehicles", authorize("admin", "officer", "supervisor", "owner", "dmp"), getVehicles);
router.post("/vehicles", authorize("owner"), createVehicle);
router.get("/vehicle-status", authorize("admin", "owner", "dmp"), getVehicleStatus);

export default router;
