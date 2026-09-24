/**
 * /api/security/* — URL / QR security checks and security event feed.
 *
 * These routes mirror the spec-required endpoints:
 *   POST /api/security/check-url
 *   POST /api/security/check-qr
 *   GET  /api/security/url-history
 *   GET  /api/security/events
 *
 * The underlying logic is shared with the existing /api/shield/phishing routes.
 */

import { Router } from "express";
import { phishingController } from "../controllers/phishing.controller";
import { securityEventsController } from "../controllers/securityEvents.controller";
import { validate } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { checkUrlSchema, checkQrSchema } from "../validators/phishing.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// POST /api/security/check-url
router.post(
  "/check-url",
  validate(checkUrlSchema),
  asyncHandler(phishingController.checkUrl)
);

// POST /api/security/check-qr   (QR codes are URL-checks with source=qr)
router.post(
  "/check-qr",
  validate(checkQrSchema),
  asyncHandler(phishingController.checkQr)
);

// GET  /api/security/url-history
router.get("/url-history", asyncHandler(phishingController.getLog));

// GET  /api/security/events
router.get("/events", asyncHandler(securityEventsController.listEvents));

export default router;
