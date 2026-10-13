import { Router } from "express";
import { threatController } from "../controllers/threat.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET  /api/threats
router.get("/", asyncHandler(threatController.listThreats));

// GET  /api/threats/:id
router.get("/:id", asyncHandler(threatController.getThreat));

export default router;
