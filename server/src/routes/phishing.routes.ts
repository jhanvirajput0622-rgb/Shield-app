import { Router } from "express";
import { phishingController } from "../controllers/phishing.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { checkUrlSchema } from "../validators/phishing.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// All phishing routes require authentication
router.use(authenticate);

// GET  /api/shield/phishing/log
router.get("/log", asyncHandler(phishingController.getLog));

// POST /api/shield/phishing/check
router.post(
  "/check",
  validate(checkUrlSchema),
  asyncHandler(phishingController.checkUrl)
);

// DELETE /api/shield/phishing/log
router.delete("/log", asyncHandler(phishingController.clearLog));

export default router;
