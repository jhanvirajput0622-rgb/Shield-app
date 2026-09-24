import { Router } from "express";
import { appPermissionController } from "../controllers/appPermission.controller";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET /api/app-permissions
router.get("/", asyncHandler(appPermissionController.listPermissions));

// GET /api/app-permissions/:id
router.get("/:id", asyncHandler(appPermissionController.getPermission));

export default router;
