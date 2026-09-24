import mongoose, { Document, Schema } from "mongoose";

export type VpnConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";

export interface IVpnSession extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId | null;
  connectionStatus: VpnConnectionStatus;
  localIp: string;
  protocol: string;
  serverLocation: string;
  encryption: string;
  bytesUploaded: number;
  bytesDownloaded: number;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VpnSessionSchema = new Schema<IVpnSession>(
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
      required: false, // Optional — a VPN session may exist before a Device is registered
      default: null,
    },
    connectionStatus: {
      type: String,
      enum: ["connecting", "connected", "disconnected", "failed"],
      default: "connecting",
    },
    localIp: { type: String, default: "" },
    protocol: { type: String, default: "WireGuard" },
    serverLocation: { type: String, default: "US East" },
    encryption: { type: String, default: "ChaCha20-Poly1305" },
    bytesUploaded: { type: Number, default: 0 },
    bytesDownloaded: { type: Number, default: 0 },
    connectedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Fast lookup: find the active session for a user
VpnSessionSchema.index({ userId: 1, connectionStatus: 1 });

export const VpnSession = mongoose.model<IVpnSession>(
  "VpnSession",
  VpnSessionSchema,
  "vpn_sessions"
);
