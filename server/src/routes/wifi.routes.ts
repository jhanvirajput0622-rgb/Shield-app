import { Router } from "express";
import { wifiController } from "../controllers/wifi.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { checkWifiSchema } from "../validators/wifi.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// POST  /api/wifi/check
router.post(
  "/check",
  validate(checkWifiSchema),
  asyncHandler(wifiController.checkNetwork)
);

// GET   /api/wifi/networks
router.get("/networks", asyncHandler(wifiController.listNetworks));

// PATCH /api/wifi/:id/trust
router.patch("/:id/trust", asyncHandler(wifiController.trustNetwork));

export default router;
