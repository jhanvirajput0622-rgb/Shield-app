import mongoose from "mongoose";
import { WifiNetwork, IWifiNetwork, WifiSecurityType } from "../models/WifiNetwork";
import { SecurityEvent } from "../models/SecurityEvent";
import { Device } from "../models/Device";

export interface WifiCheckInput {
  /** SHA-256 of the SSID — raw SSID is never sent to or stored on the server */
  networkHash: string;
  securityType: WifiSecurityType;
  signalStrength?: number | null;
}

export class WifiService {
  /**
   * Record a network observation and assess its risk.
   * Returns the upserted WifiNetwork document.
   */
  async checkNetwork(
    userId: mongoose.Types.ObjectId,
    input: WifiCheckInput
  ): Promise<IWifiNetwork> {
    const device = await Device.findOne({ userId }).sort({ lastSeenAt: -1 });
    const deviceId = device?._id ?? new mongoose.Types.ObjectId();

    const isUnsecured = ["OPEN", "WEP"].includes(input.securityType);

    const network = await WifiNetwork.findOneAndUpdate(
      { userId, deviceId, networkHash: input.networkHash },
      {
        $set: {
          securityType: input.securityType,
          isUnsecured,
          signalStrength: input.signalStrength ?? null,
          lastDetectedAt: new Date(),
        },
        $setOnInsert: {
          firstDetectedAt: new Date(),
          isTrusted: false,
        },
      },
      { upsert: true, new: true }
    );

    // Emit a security event for open/unsecured networks
    if (isUnsecured) {
      await SecurityEvent.create({
        userId,
        deviceId,
        eventType: "unsecured_network_detected",
        severity: input.securityType === "OPEN" ? "high" : "medium",
        title: `Unsecured Wi-Fi network detected (${input.securityType})`,
        description:
          "Connected to an unencrypted Wi-Fi network. VPN is strongly recommended.",
        isBlocked: false,
        occurredAt: new Date(),
      });
    }

    return network;
  }

  async getNetworks(userId: mongoose.Types.ObjectId): Promise<IWifiNetwork[]> {
    return WifiNetwork.find({ userId }).sort({ lastDetectedAt: -1 }).limit(50);
  }

  async trustNetwork(
    userId: mongoose.Types.ObjectId,
    networkId: string
  ): Promise<IWifiNetwork> {
    const network = await WifiNetwork.findOneAndUpdate(
      { _id: networkId, userId },
      { $set: { isTrusted: true } },
      { new: true }
    );
    if (!network) {
      const { ApiError } = await import("../utils/ApiError.js");
      throw ApiError.notFound("Network");
    }
    return network;
  }
}

export const wifiService = new WifiService();
