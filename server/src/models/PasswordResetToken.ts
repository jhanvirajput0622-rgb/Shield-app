import mongoose, { Document, Schema } from "mongoose";
import crypto from "crypto";

export interface IPasswordResetToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** SHA-256 hash of the opaque token sent to the user — never store raw */
  tokenHash: string;
  expiresAt: Date;
  /** Marked true once the token has been used to reset the password */
  used: boolean;
  createdAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for fast lookup
PasswordResetTokenSchema.index({ tokenHash: 1, used: 1, expiresAt: 1 });
// TTL — MongoDB auto-deletes expired tokens after 1 hour grace period
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

/** Hash a raw reset token (SHA-256) */
export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generate a 256-bit cryptographically random token */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export const PasswordResetToken = mongoose.model<IPasswordResetToken>(
  "PasswordResetToken",
  PasswordResetTokenSchema,
  "password_reset_tokens"
);
