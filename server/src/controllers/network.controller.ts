import { Request, Response } from "express";
import { networkService } from "../services/network.service";
import { auditService } from "../services/audit.service";

export const networkController = {
  async getNetworkStatus(req: Request, res: Response): Promise<void> {
    const active = await networkService.getActiveSession(req.userId);

    res.json({
      ssid: "Unknown",
      isSecured: !!active,
      signalStrength: -65,
      speedMbps: 0,
      riskLevel: active ? "safe" : "warning",
      vpnConnected: !!active,
      vpnSession: active
        ? {
            connected: true,
            localIp: active.localIp,
            protocol: active.protocol,
            serverLocation: active.serverLocation,
            encryption: active.encryption,
            connectedAt: active.connectedAt?.toISOString(),
          }
        : undefined,
    });
  },

  async connectVpn(req: Request, res: Response): Promise<void> {
    const { protocol, ssid, isSecured } = req.body ?? {};

    const session = await networkService.connect(req.userId, {
      protocol,
      ssid,
      isSecured,
    });

    auditService.log(req.userId, "VPN_CONNECT", `VPN connected via ${session.protocol}`, {
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "",
      metadata: { protocol: session.protocol, server: session.serverLocation },
    }).catch(() => {});

    res.json({
      connected: true,
      localIp: session.localIp,
      protocol: session.protocol,
      serverLocation: session.serverLocation,
      encryption: session.encryption,
      connectedAt: session.connectedAt?.toISOString(),
    });
  },

  async disconnectVpn(req: Request, res: Response): Promise<void> {
    await networkService.disconnect(req.userId);

    auditService.log(req.userId, "VPN_DISCONNECT", "VPN disconnected", {
      ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "",
    }).catch(() => {});

    res.json({ success: true });
  },
};
