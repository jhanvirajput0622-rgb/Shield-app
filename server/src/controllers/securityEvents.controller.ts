import { Request, Response } from "express";
import { SecurityEvent } from "../models/SecurityEvent";

export const securityEventsController = {
  // ── GET /api/security/events ─────────────────────────────────────────────
  async listEvents(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      SecurityEvent.find({ userId: req.userId })
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SecurityEvent.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      success: true,
      data: events.map((e) => ({
        id: e._id.toString(),
        eventType: e.eventType,
        severity: e.severity,
        title: e.title,
        description: e.description,
        isBlocked: e.isBlocked,
        metadata: e.metadata,
        deviceId: e.deviceId?.toString() ?? null,
        occurredAt: e.occurredAt instanceof Date
          ? e.occurredAt.toISOString()
          : new Date(e.occurredAt as unknown as string).toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  },
};
