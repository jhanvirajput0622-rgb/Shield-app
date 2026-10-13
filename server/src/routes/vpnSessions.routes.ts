import { Router } from "express";
import { vpnSessionController } from "../controllers/vpnSession.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET /api/vpn-sessions
router.get("/", asyncHandler(vpnSessionController.listSessions));

// GET /api/vpn-sessions/:id
router.get("/:id", asyncHandler(vpnSessionController.getSession));

export default router;
