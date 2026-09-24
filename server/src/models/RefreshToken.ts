import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export interface IRefreshToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId | null;
  /** SHA-256 hash of the opaque token — never store the raw token */
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  /** IP / user-agent captured at issuance — useful for anomaly detection */
  issuedAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
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
      default: null,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // No updatedAt needed — tokens are write-once then revoked
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fast validity check
RefreshTokenSchema.index({ tokenHash: 1, revoked: 1, expiresAt: 1 });

// TTL index — MongoDB auto-deletes expired rows after expiry
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Hash a raw token string using SHA-256 */
export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generate a cryptographically random opaque token (256-bit) */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const RefreshToken = mongoose.model<IRefreshToken>(
  "RefreshToken",
  RefreshTokenSchema,
  "refresh_tokens"
);
