/**
 * /api/theft/* — spec-required anti-theft routes.
 *
 * All routes require authentication + device ownership.
 * Destructive operations (lock / wipe) are rate-limited.
 */
import { Router } from "express";
import { theftController } from "../controllers/theft.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { destructiveLimiter } from "../middleware/rateLimiter.middleware";
import {
  lockDeviceSchema,
  wipeDeviceSchema,
} from "../validators/antitheft.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// POST /api/theft/locate
router.post("/locate", asyncHandler(theftController.locate));

// POST /api/theft/lock
router.post(
  "/lock",
  destructiveLimiter,
  validate(lockDeviceSchema),
  asyncHandler(theftController.lock)
);

// POST /api/theft/wipe
router.post(
  "/wipe",
  destructiveLimiter,
  validate(wipeDeviceSchema),
  asyncHandler(theftController.wipe)
);

// GET  /api/theft/commands
router.get("/commands", asyncHandler(theftController.listCommands));

// GET  /api/theft/location/:deviceId
router.get("/location/:deviceId", asyncHandler(theftController.getLocation));

export default router;
