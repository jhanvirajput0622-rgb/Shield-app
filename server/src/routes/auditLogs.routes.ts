import { Router } from "express";
import { auditLogController } from "../controllers/auditLog.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET /api/audit-logs
router.get("/", asyncHandler(auditLogController.listLogs));

export default router;
