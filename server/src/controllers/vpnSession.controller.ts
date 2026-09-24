import { Request, Response } from "express";
import { VpnSession } from "../models/VpnSession";
import { ApiError } from "../utils/ApiError";
import { auditService } from "../services/audit.service";

export const vpnSessionController = {
  // GET /api/vpn-sessions
  async listSessions(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query["page"]) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"]) || 20));
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      VpnSession.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      VpnSession.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      success: true,
      data: sessions.map((s) => ({
        id: s._id.toString(),
        connectionStatus: s.connectionStatus,
        protocol: s.protocol,
        serverLocation: s.serverLocation,
        encryption: s.encryption,
        bytesUploaded: s.bytesUploaded,
        bytesDownloaded: s.bytesDownloaded,
        connectedAt: s.connectedAt?.toISOString() ?? null,
        disconnectedAt: s.disconnectedAt?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      meta: { total, page, limit },
    });
  },

  // GET /api/vpn-sessions/:id
  async getSession(req: Request, res: Response): Promise<void> {
    const session = await VpnSession.findOne({
      _id: req.params["id"],
      userId: req.userId, // Ownership enforced
    });
    if (!session) throw ApiError.notFound("VpnSession");

    res.json({
      success: true,
      data: {
        id: session._id.toString(),
        connectionStatus: session.connectionStatus,
        protocol: session.protocol,
        serverLocation: session.serverLocation,
        encryption: session.encryption,
        bytesUploaded: session.bytesUploaded,
        bytesDownloaded: session.bytesDownloaded,
        connectedAt: session.connectedAt?.toISOString() ?? null,
        disconnectedAt: session.disconnectedAt?.toISOString() ?? null,
      },
    });
  },
};
