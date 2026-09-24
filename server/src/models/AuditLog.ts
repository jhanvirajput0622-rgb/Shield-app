import mongoose, { Document, Schema } from "mongoose";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "REGISTER"
  | "PASSWORD_RESET"
  | "VPN_CONNECT"
  | "VPN_DISCONNECT"
  | "URL_CHECK"
  | "THREAT_DETECTED"
  | "LOCK_DEVICE"
  | "WIPE_DEVICE"
  | "LOCATE_DEVICE"
  | "PERMISSION_SCAN"
  | "SETTINGS_UPDATED"
  | "DEVICE_REGISTERED"
  | "DEVICE_DELETED"
  | "TOKEN_REFRESH"
  | "COMPANION_LOGIN"
  | "COMPANION_LOGOUT";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  /** Device context — may be null for auth events that predate device reg */
  deviceId: mongoose.Types.ObjectId | null;
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  /**
   * Encrypted JSON payload — encrypted with server ENCRYPTION_KEY.
   * Contains details like IP, user-agent, metadata.
   * Never expose to clients; used only for internal audit / admin tools.
   */
  detailsEncrypted: string;
  /** Non-sensitive summary — shown in audit trail UI */
  summary: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "REGISTER",
        "PASSWORD_RESET",
        "VPN_CONNECT",
        "VPN_DISCONNECT",
        "URL_CHECK",
        "THREAT_DETECTED",
        "LOCK_DEVICE",
        "WIPE_DEVICE",
        "LOCATE_DEVICE",
        "PERMISSION_SCAN",
        "SETTINGS_UPDATED",
        "DEVICE_REGISTERED",
        "DEVICE_DELETED",
        "TOKEN_REFRESH",
        "COMPANION_LOGIN",
        "COMPANION_LOGOUT",
      ],
    },
    detailsEncrypted: { type: String, default: "", select: false },
    summary: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  {
    // Audit logs are append-only — no updatedAt needed
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Fast lookup by user + time for audit trail
AuditLogSchema.index({ userId: 1, createdAt: -1 });
// Index by device for device-level audit
AuditLogSchema.index({ deviceId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema, "audit_logs");
