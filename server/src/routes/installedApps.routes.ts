import { Router } from "express";
import { installedAppController } from "../controllers/installedApp.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET /api/installed-apps
router.get("/", asyncHandler(installedAppController.listApps));

// GET /api/installed-apps/:id
router.get("/:id", asyncHandler(installedAppController.getApp));

export default router;
