import { Router } from "express";
import { authorize } from "../middleware/auth.js";
import {
  createCamera, createZone, getCamerasAboveAverage, getPendingAppeals, getPendingAppealSummary, getTotalFine,
  getVehicleFitness, getVehicleLookup, getVehicleProfile, getVehicleViolations, updateCamera, updateZone, verifyViolation
} from "../controllers/evaluationController.js";

const router = Router();
router.get("/reports/cameras-above-average", authorize("admin"), getCamerasAboveAverage);
router.get("/reports/vehicle-violations/:plate", authorize("admin", "officer", "dmp"), getVehicleViolations);
router.get("/reports/vehicle-profile/:plate", authorize("admin", "dmp"), getVehicleProfile);
router.get("/reports/vehicle-lookup/:plate", authorize("admin", "dmp"), getVehicleLookup);
router.get("/reports/vehicle-fitness/:plate", authorize("owner", "dmp", "admin"), getVehicleFitness);
router.get("/reports/total-fine", authorize("owner"), getTotalFine);
router.get("/reports/pending-appeal-summary", authorize("supervisor"), getPendingAppealSummary);
router.get("/reports/pending-appeals", authorize("supervisor"), getPendingAppeals);
router.patch("/violations/:eventId/verification", authorize("officer"), verifyViolation);
router.post("/cameras", authorize("admin"), createCamera);
router.patch("/cameras/:cameraId", authorize("admin"), updateCamera);
router.post("/zones", authorize("admin"), createZone);
router.patch("/zones/:zoneId", authorize("admin"), updateZone);
export default router;
