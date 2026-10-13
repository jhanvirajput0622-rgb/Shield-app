import { Router } from "express";
import { userSettingController } from "../controllers/userSetting.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  upsertSettingSchema,
  batchUpsertSchema,
} from "../validators/userSetting.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET  /api/user-settings
router.get("/", asyncHandler(userSettingController.listSettings));

// POST /api/user-settings/batch — upsert multiple
router.post(
  "/batch",
  validate(batchUpsertSchema),
  asyncHandler(userSettingController.batchUpsert)
);

// PUT /api/user-settings/:key
router.put(
  "/:key",
  validate(upsertSettingSchema),
  asyncHandler(userSettingController.upsertSetting)
);

// DELETE /api/user-settings/:key
router.delete("/:key", asyncHandler(userSettingController.deleteSetting));

export default router;
