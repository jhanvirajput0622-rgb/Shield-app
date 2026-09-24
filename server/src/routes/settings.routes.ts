import { Router } from "express";
import { settingsController } from "../controllers/settings.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { updateSettingsSchema } from "../validators/settings.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET   /api/shield/settings
router.get("/", asyncHandler(settingsController.getSettings));

// PATCH /api/shield/settings
router.patch(
  "/",
  validate(updateSettingsSchema),
  asyncHandler(settingsController.updateSettings)
);

export default router;
