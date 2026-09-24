import mongoose, { Document, Schema } from "mongoose";

/**
 * WifiNetwork — stores metadata about networks seen by a device.
 *
 * PRIVACY RULES:
 *   - Wi-Fi passwords are NEVER stored.
 *   - The raw SSID is hashed before storage (networkHash) to protect user
 *     location privacy while still allowing duplicate detection.
 *   - The original SSID is never persisted on the server.
 */
export type WifiSecurityType =
  | "WPA3"
  | "WPA2"
  | "WPA"
  | "WEP"
  | "OPEN"
  | "UNKNOWN";

export interface IWifiNetwork extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  /** SHA-256 of the SSID — privacy-preserving identifier */
  networkHash: string;
  securityType: WifiSecurityType;
  /** True if the user has marked this network as trusted */
  isTrusted: boolean;
  /** True when securityType is OPEN or WEP */
  isUnsecured: boolean;
  signalStrength: number | null;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WifiNetworkSchema = new Schema<IWifiNetwork>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    networkHash: {
      type: String,
      required: true,
      index: true,
    },
    securityType: {
      type: String,
      enum: ["WPA3", "WPA2", "WPA", "WEP", "OPEN", "UNKNOWN"],
      default: "UNKNOWN",
    },
    isTrusted: { type: Boolean, default: false },
    isUnsecured: { type: Boolean, default: false },
    signalStrength: { type: Number, default: null },
    firstDetectedAt: { type: Date, default: Date.now },
    lastDetectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One record per user+device+network combination
WifiNetworkSchema.index(
  { userId: 1, deviceId: 1, networkHash: 1 },
  { unique: true }
);

export const WifiNetwork = mongoose.model<IWifiNetwork>(
  "WifiNetwork",
  WifiNetworkSchema,
  "wifi_networks"
);
