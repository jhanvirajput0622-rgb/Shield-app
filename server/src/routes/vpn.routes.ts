import { Router } from "express";
import { vpnController } from "../controllers/vpn.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// POST   /api/vpn/session   — start / connect
router.post("/session", asyncHandler(vpnController.createSession));

// GET    /api/vpn/sessions  — history
router.get("/sessions", asyncHandler(vpnController.listSessions));

// PATCH  /api/vpn/session/:id  — disconnect / update bytes
router.patch("/session/:id", asyncHandler(vpnController.updateSession));

export default router;
