import { Router } from "express";
import { permissionsController } from "../controllers/permissions.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// ── /api/shield/permissions  (existing paths kept for mobile backward-compat) ─
// GET  /api/shield/permissions
router.get("/", asyncHandler(permissionsController.getPermissions));

// POST /api/shield/permissions/scan
router.post("/scan", asyncHandler(permissionsController.runScan));

// ── /api/permissions  (spec-required paths — mounted at /api/permissions) ────
// These aliases are registered in server.ts via a second mount, but the handler
// is the same permissionsController so we export this single router.

export default router;
