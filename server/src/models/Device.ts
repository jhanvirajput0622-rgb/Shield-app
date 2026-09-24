import mongoose, { Document, Schema } from "mongoose";

export type DeviceStatus = "online" | "offline" | "lost" | "locked" | "wiped";
export type PendingAction = "none" | "locate" | "lock" | "wipe";
export type ActionStatus = "idle" | "queued" | "delivered" | "completed" | "failed";

export interface IDevice extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceName: string;
  platform: string;       // "iOS" | "Android"
  osVersion: string;
  appVersion: string;
  deviceModel: string;      // Renamed from "model" to avoid conflict with Mongoose Document.model
  /**
   * Safe public-key fingerprint (e.g. SHA-256 of device public key).
   * The actual private key NEVER leaves the device (iOS Keychain / Android Keystore).
   */
  deviceKeyFingerprint: string;
  /** @deprecated use deviceKeyFingerprint. Retained for backward-compat. */
  publicKey: string;
  status: DeviceStatus;
  isOnline: boolean;
  batteryPercent: number;
  lastSeenAt: Date;
  vpnEnabled: boolean;
  theftProtectionEnabled: boolean;
  // Location (optional — only stored when user triggers Locate)
  locationAvailable: boolean;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string;
  locationAccuracy: number | null;
  locationUpdatedAt: Date | null;
  // Remote command state
  pendingAction: PendingAction;
  actionStatus: ActionStatus;
  lockMessage: string;
  // Telemetry
  simStatus: string;
  gpsPrecision: string;
  networkEncryption: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceName: { type: String, default: "Shield Device", trim: true },
    platform: { type: String, default: "iOS" },
    osVersion: { type: String, default: "" },
    appVersion: { type: String, default: "" },
    deviceModel: { type: String, default: "" },
    deviceKeyFingerprint: { type: String, default: "" },
    publicKey: { type: String, default: "" },
    status: {
      type: String,
      enum: ["online", "offline", "lost", "locked", "wiped"],
      default: "online",
    },
    isOnline: { type: Boolean, default: true },
    batteryPercent: { type: Number, default: 100, min: 0, max: 100 },
    lastSeenAt: { type: Date, default: Date.now },
    vpnEnabled: { type: Boolean, default: false },
    theftProtectionEnabled: { type: Boolean, default: false },
    locationAvailable: { type: Boolean, default: false },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    locationLabel: { type: String, default: "" },
    locationAccuracy: { type: Number, default: null },
    locationUpdatedAt: { type: Date, default: null },
    pendingAction: {
      type: String,
      enum: ["none", "locate", "lock", "wipe"],
      default: "none",
    },
    actionStatus: {
      type: String,
      enum: ["idle", "queued", "delivered", "completed", "failed"],
      default: "idle",
    },
    lockMessage: { type: String, default: "" },
    simStatus: { type: String, default: "Active" },
    gpsPrecision: { type: String, default: "±8m" },
    networkEncryption: { type: String, default: "WPA3" },
  },
  { timestamps: true }
);

// A user can register many devices; index by userId for fast lookup
DeviceSchema.index({ userId: 1, status: 1 });

export const Device = mongoose.model<IDevice>("Device", DeviceSchema, "devices");
