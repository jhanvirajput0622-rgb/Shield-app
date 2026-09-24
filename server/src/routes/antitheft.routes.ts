import { Router } from "express";
import { antitheftController } from "../controllers/antitheft.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { destructiveLimiter } from "../middleware/rateLimiter.middleware";
import {
  lockDeviceSchema,
  wipeDeviceSchema,
  registerDeviceSchema,
  locateDeviceSchema,
} from "../validators/antitheft.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// POST /api/shield/device/register
router.post(
  "/register",
  validate(registerDeviceSchema),
  asyncHandler(antitheftController.registerDevice)
);

// GET  /api/shield/device
router.get("/", asyncHandler(antitheftController.getDeviceStatus));

// POST /api/shield/device/locate
router.post(
  "/locate",
  validate(locateDeviceSchema),
  asyncHandler(antitheftController.locateDevice)
);

// POST /api/shield/device/lock
router.post(
  "/lock",
  destructiveLimiter,
  validate(lockDeviceSchema),
  asyncHandler(antitheftController.lockDevice)
);

// POST /api/shield/device/wipe
router.post(
  "/wipe",
  destructiveLimiter,
  validate(wipeDeviceSchema),
  asyncHandler(antitheftController.wipeDevice)
);

export default router;
