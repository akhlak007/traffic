import { Router } from "express";
import { listResource } from "../controllers/resourceController.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

router.get("/cameras", authorize("admin", "officer", "dmp"), listResource("cameras"));
router.get("/zones", authorize("admin", "officer", "dmp"), listResource("zones"));
router.get("/roadSegments", authorize("admin", "officer", "dmp"), listResource("roadSegments"));
router.get("/users", authorize("admin"), listResource("users"));
router.get("/cameraEvents", authorize("admin", "officer", "supervisor", "dmp"), listResource("cameraEvents"));
router.get("/violationEvents", authorize("officer", "supervisor"), listResource("violationEvents"));
router.get("/evidence", authorize("officer", "supervisor"), listResource("evidence"));
router.get("/alertEvents", authorize("officer", "dmp"), listResource("alertEvents"));
router.get("/roadDefectEvents", authorize("officer"), listResource("roadDefectEvents"));
router.get("/suspiciousVehicleEvents", authorize("dmp"), listResource("suspiciousVehicleEvents"));
router.get("/riskAnalysis", authorize("admin", "dmp"), listResource("riskAnalysis"));
router.get("/vehicleJourney", authorize("dmp"), listResource("vehicleJourney"));
router.get("/congestion-events", authorize("officer", "dmp"), listResource("congestionEvents"));

export default router;
