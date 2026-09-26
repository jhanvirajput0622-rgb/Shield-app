import { Request, Response } from "express";
import { wifiService } from "../services/wifi.service";
import { WifiSecurityType } from "../models/WifiNetwork";
import { ApiError } from "../utils/ApiError";

export const wifiController = {
  // ── POST /api/wifi/check ──────────────────────────────────────────────────
  async checkNetwork(req: Request, res: Response): Promise<void> {
    const {
      networkHash,
      securityType = "UNKNOWN",
      signalStrength,
    } = req.body as {
      networkHash: string;
      securityType?: WifiSecurityType;
      signalStrength?: number | null;
    };

    const network = await wifiService.checkNetwork(req.userId, {
      networkHash,
      securityType: securityType as WifiSecurityType,
      signalStrength: signalStrength ?? null,
    });

    res.json({
      success: true,
      data: {
        id: network._id.toString(),
        networkHash: network.networkHash,
        securityType: network.securityType,
        isTrusted: network.isTrusted,
        isUnsecured: network.isUnsecured,
        riskLevel: network.isUnsecured ? "danger" : "safe",
        firstDetectedAt: network.firstDetectedAt.toISOString(),
        lastDetectedAt: network.lastDetectedAt.toISOString(),
      },
    });
  },

  // ── GET /api/wifi/networks ────────────────────────────────────────────────
  async listNetworks(req: Request, res: Response): Promise<void> {
    const networks = await wifiService.getNetworks(req.userId);
    res.json({
      success: true,
      data: networks.map((n) => ({
        id: n._id.toString(),
        networkHash: n.networkHash,
        securityType: n.securityType,
        isTrusted: n.isTrusted,
        isUnsecured: n.isUnsecured,
        signalStrength: n.signalStrength,
        firstDetectedAt: n.firstDetectedAt.toISOString(),
        lastDetectedAt: n.lastDetectedAt.toISOString(),
      })),
    });
  },

  // ── PATCH /api/wifi/:id/trust ─────────────────────────────────────────────
  async trustNetwork(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const network = await wifiService.trustNetwork(req.userId, id);
    res.json({
      success: true,
      data: {
        id: network._id.toString(),
        networkHash: network.networkHash,
        securityType: network.securityType,
        isTrusted: network.isTrusted,
        isUnsecured: network.isUnsecured,
      },
    });
  },
};
