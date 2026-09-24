import mongoose, { Document, Schema } from "mongoose";

export type PhishingVerdict = "safe" | "malicious" | "unknown" | "suspicious";
export type PhishingSource = "manual_check" | "auto_scan" | "sms" | "qr";

export interface IPhishingCheck extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  /** SHA-512 prefix (privacy-preserving — never store the raw URL) */
  urlHash: string;
  /** E2E-encrypted URL blob — server cannot decrypt */
  encryptedUrl: string;
  /** Display domain only — hostname extracted on-device */
  domain: string;
  verdict: PhishingVerdict;
  threatType: string | null;
  source: PhishingSource;
  checkedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PhishingCheckSchema = new Schema<IPhishingCheck>(
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
    urlHash: { type: String, required: true, index: true },
    encryptedUrl: { type: String, default: "" },
    domain: { type: String, required: true, lowercase: true, trim: true },
    verdict: {
      type: String,
      enum: ["safe", "malicious", "unknown", "suspicious"],
      default: "unknown",
    },
    threatType: { type: String, default: null },
    source: {
      type: String,
      enum: ["manual_check", "auto_scan", "sms", "qr"],
      default: "manual_check",
    },
    checkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PhishingCheckSchema.index({ userId: 1, checkedAt: -1 });

export const PhishingCheck = mongoose.model<IPhishingCheck>(
  "PhishingCheck",
  PhishingCheckSchema,
  "web_checks"
);
