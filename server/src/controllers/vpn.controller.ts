import { Request, Response } from "express";
import { networkService } from "../services/network.service";
import { VpnSession, IVpnSession } from "../models/VpnSession";
import { ApiError } from "../utils/ApiError";

function sessionView(s: IVpnSession) {
  return {
    id: s._id.toString(),
    connectionStatus: s.connectionStatus,
    localIp: s.localIp,
    protocol: s.protocol,
    serverLocation: s.serverLocation,
    encryption: s.encryption,
    bytesUploaded: s.bytesUploaded,
    bytesDownloaded: s.bytesDownloaded,
    connectedAt: s.connectedAt?.toISOString() ?? null,
    disconnectedAt: s.disconnectedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

export const vpnController = {
  // ── POST /api/vpn/session  (connect) ──────────────────────────────────────
  async createSession(req: Request, res: Response): Promise<void> {
    const session = await networkService.connect(req.userId);
    res.status(201).json({ success: true, data: sessionView(session) });
  },

  // ── GET /api/vpn/sessions ─────────────────────────────────────────────────
  async listSessions(req: Request, res: Response): Promise<void> {
    const sessions = await VpnSession.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20) as unknown as IVpnSession[];
    res.json({ success: true, data: sessions.map(sessionView) });
  },

  // ── PATCH /api/vpn/session/:id  (disconnect / update) ────────────────────
  async updateSession(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { connectionStatus, bytesUploaded, bytesDownloaded } = req.body as {
      connectionStatus?: string;
      bytesUploaded?: number;
      bytesDownloaded?: number;
    };

    const patch: Record<string, unknown> = {};
    if (connectionStatus === "disconnected") {
      patch.connectionStatus = "disconnected";
      patch.disconnectedAt = new Date();
    }
    if (typeof bytesUploaded === "number") patch.bytesUploaded = bytesUploaded;
    if (typeof bytesDownloaded === "number") patch.bytesDownloaded = bytesDownloaded;

    const session = await VpnSession.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: patch },
      { new: true }
    ) as unknown as IVpnSession | null;
    if (!session) throw ApiError.notFound("VPN session");

    res.json({ success: true, data: sessionView(session) });
  },
};
