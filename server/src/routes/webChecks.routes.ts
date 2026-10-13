import { Router } from "express";
import { webCheckController } from "../controllers/webCheck.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET /api/web-checks
router.get("/", asyncHandler(webCheckController.listChecks));

// GET /api/web-checks/:id
router.get("/:id", asyncHandler(webCheckController.getCheck));

export default router;
