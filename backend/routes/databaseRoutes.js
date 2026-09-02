import express from "express";
import { getTables, getTableData } from "../controllers/databaseController.js";
import { authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/tables", authorize("admin"), getTables);
router.get("/tables/:tableName", authorize("admin"), getTableData);

export default router;
