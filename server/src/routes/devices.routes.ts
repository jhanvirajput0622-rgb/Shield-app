import { Router } from "express";
import { devicesController } from "../controllers/devices.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { pushTokenSchema, registerDeviceSchema } from "../validators/devices.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All device routes require authentication
router.use(authenticate);

// GET    /api/devices
router.get("/", asyncHandler(devicesController.listDevices));

// POST   /api/devices
router.post(
  "/",
  validate(registerDeviceSchema),
  asyncHandler(devicesController.registerDevice)
);

router.post(
  "/push-token",
  validate(pushTokenSchema),
  asyncHandler(devicesController.registerPushToken)
);

// GET    /api/devices/:id
router.get("/:id", asyncHandler(devicesController.getDevice));

// DELETE /api/devices/:id
router.delete("/:id", asyncHandler(devicesController.deleteDevice));

export default router;
