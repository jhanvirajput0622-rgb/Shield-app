import { Request, Response } from "express";
import mongoose from "mongoose";
import { Notification } from "../models/Notification";
import { ApiError } from "../utils/ApiError";
import { MarkReadBody } from "../validators/notification.validator";

export const notificationController = {
  // GET /api/notifications
  async listNotifications(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query["page"]) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"]) || 20));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query["unread"] === "true";

    const filter: Record<string, unknown> = { userId: req.userId };
    if (unreadOnly) filter["isRead"] = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.userId, isRead: false }),
    ]);

    res.json({
      success: true,
      data: notifications,
      meta: { total, unreadCount, page, limit },
    });
  },

  // PATCH /api/notifications/mark-read — mark selected notifications as read
  async markRead(req: Request, res: Response): Promise<void> {
    const { ids } = req.body as MarkReadBody;
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    await Notification.updateMany(
      { _id: { $in: objectIds }, userId: req.userId }, // Ownership enforced
      { $set: { isRead: true } }
    );

    res.json({ success: true });
  },

  // PATCH /api/notifications/mark-all-read
  async markAllRead(req: Request, res: Response): Promise<void> {
    await Notification.updateMany(
      { userId: req.userId, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  },

  // DELETE /api/notifications/:id
  async deleteNotification(req: Request, res: Response): Promise<void> {
    const notif = await Notification.findOneAndDelete({
      _id: req.params["id"],
      userId: req.userId,
    });
    if (!notif) throw ApiError.notFound("Notification");
    res.json({ success: true });
  },
};
