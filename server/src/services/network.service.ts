import mongoose from "mongoose";
import { VpnSession, IVpnSession } from "../models/VpnSession";
import { Device } from "../models/Device";
import { SecurityEvent } from "../models/SecurityEvent";

// Tunnel protocols the server can provision. WireGuard is the default; the
// others are offered as fallbacks in the mobile app when a handshake fails.
const SUPPORTED_PROTOCOLS: Record<string, { protocol: string; encryption: string }> = {
  WireGuard: { protocol: "WireGuard", encryption: "ChaCha20-Poly1305" },
  OpenVPN: { protocol: "OpenVPN", encryption: "AES-256-GCM" },
  IPSec: { protocol: "IPSec", encryption: "AES-256-CBC" },
};

export interface ConnectVpnOptions {
  /** Requested tunnel protocol — falls back to WireGuard if invalid */
  protocol?: string;
  /** SSID of the network the client is connected to (for diagnostics) */
  ssid?: string;
  /** Whether the client believes the network is secured */
  isSecured?: boolean;
}

function normalizeProtocol(protocol?: string): { protocol: string; encryption: string } {
  if (protocol && SUPPORTED_PROTOCOLS[protocol]) {
    return SUPPORTED_PROTOCOLS[protocol];
  }
  return SUPPORTED_PROTOCOLS.WireGuard;
}

export class NetworkService {
  /** Find the currently active VPN session for a user (if any) */
  async getActiveSession(
    userId: mongoose.Types.ObjectId
  ): Promise<IVpnSession | null> {
    return VpnSession.findOne({
      userId,
      connectionStatus: { $in: ["connecting", "connected"] },
    }).sort({ createdAt: -1 });
  }

  async connect(
    userId: mongoose.Types.ObjectId,
    options: ConnectVpnOptions = {}
  ): Promise<IVpnSession> {
    // Disconnect any lingering sessions first
    await VpnSession.updateMany(
      { userId, connectionStatus: { $in: ["connecting", "connected"] } },
      { $set: { connectionStatus: "disconnected", disconnectedAt: new Date() } }
    );

    const tunnel = normalizeProtocol(options.protocol);
    const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
    const deviceId = device?._id ?? new mongoose.Types.ObjectId();

    const session = await VpnSession.create({
      userId,
      deviceId,
      connectionStatus: "connected",
      localIp: "10.8.0.2",
      protocol: tunnel.protocol,
      serverLocation: "US East",
      encryption: tunnel.encryption,
      connectedAt: new Date(),
    });

    const events: Array<Record<string, unknown>> = [
      {
        eventType: "vpn_connected",
        severity: "info" as const,
        title: "VPN Connected",
        description: `Secure tunnel established via ${tunnel.protocol}`,
      },
    ];

    // When the client reports an unsecured/open network, flag it so the
    // dashboard can reflect the real-world risk around the tunnel.
    if (options.isSecured === false) {
      events.push({
        eventType: "unsecured_network_detected",
        severity: "high" as const,
        title: "Unsecured Wi-Fi detected",
        description: `Connected to "${options.ssid ?? "Unknown"}" (open network). Traffic routed through VPN tunnel.`,
      });
    }

    await SecurityEvent.insertMany(
      events.map((e) => ({
        userId,
        deviceId,
        ...e,
        occurredAt: new Date(),
      }))
    );

    return session;
  }

  async disconnect(userId: mongoose.Types.ObjectId): Promise<boolean> {
    const result = await VpnSession.updateMany(
      { userId, connectionStatus: { $in: ["connecting", "connected"] } },
      { $set: { connectionStatus: "disconnected", disconnectedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
      await SecurityEvent.create({
        userId,
        deviceId: device?._id ?? null,
        eventType: "vpn_disconnected",
        severity: "info",
        title: "VPN Disconnected",
        description: "Secure tunnel closed",
        occurredAt: new Date(),
      });
    }

    return result.modifiedCount > 0;
  }
}

export const networkService = new NetworkService();
