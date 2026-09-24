import { Router } from "express";
import { notificationController } from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { markReadSchema } from "../validators/notification.validator";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.use(authenticate);

// GET  /api/notifications
router.get("/", asyncHandler(notificationController.listNotifications));

// PATCH /api/notifications/mark-read
router.patch(
  "/mark-read",
  validate(markReadSchema),
  asyncHandler(notificationController.markRead)
);

// PATCH /api/notifications/mark-all-read
router.patch(
  "/mark-all-read",
  asyncHandler(notificationController.markAllRead)
);

// DELETE /api/notifications/:id
router.delete("/:id", asyncHandler(notificationController.deleteNotification));

export default router;
