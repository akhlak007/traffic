import { Router } from "express";
import { createNotice, getNotices, getNoticeById } from "../controllers/noticeController.js";
import { authorize } from "../middleware/auth.js";

const router = Router();

router.get("/notices", authorize("admin", "officer", "supervisor", "owner"), getNotices);
router.get("/notices/:noticeId", authorize("admin", "officer", "supervisor", "owner"), getNoticeById);
router.post("/notices", authorize("officer"), createNotice);

export default router;
