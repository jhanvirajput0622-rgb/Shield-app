import { Request, Response } from "express";
import { auditService } from "../services/audit.service";

export const auditLogController = {
  // GET /api/audit-logs
  async listLogs(req: Request, res: Response): Promise<void> {
    const limit = Math.min(200, Math.max(1, Number(req.query["limit"]) || 50));
    const logs = await auditService.getRecentLogs(req.userId, limit);

    res.json({
      success: true,
      data: logs.map((l) => ({
        id: l._id.toString(),
        action: l.action,
        summary: l.summary,
        deviceId: l.deviceId?.toString() ?? null,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  },
};
