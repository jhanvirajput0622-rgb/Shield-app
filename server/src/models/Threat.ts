import mongoose, { Document, Schema } from "mongoose";

export type ThreatType =
  | "Phishing"
  | "Malware"
  | "Suspicious URL"
  | "Spyware"
  | "Ransomware"
  | "Credential Theft"
  | "Social Engineering"
  | "Adware"
  | "Trojan";

export type ThreatSeverity = "Low" | "Medium" | "High" | "Critical";

export interface IThreat extends Document {
  _id: mongoose.Types.ObjectId;
  threatType: ThreatType;
  threatName: string;
  description: string;
  severity: ThreatSeverity;
  /** Where intelligence was sourced from (e.g. "internal", "google-safebrowsing") */
  source: string;
  indicators: string[]; // domains, hashes, IPs associated with this threat
  firstSeenAt: Date;
  lastSeenAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ThreatSchema = new Schema<IThreat>(
  {
    threatType: {
      type: String,
      required: true,
      enum: [
        "Phishing",
        "Malware",
        "Suspicious URL",
        "Spyware",
        "Ransomware",
        "Credential Theft",
        "Social Engineering",
        "Adware",
        "Trojan",
      ],
      index: true,
    },
    threatName: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    severity: {
      type: String,
      required: true,
      enum: ["Low", "Medium", "High", "Critical"],
      index: true,
    },
    source: { type: String, default: "internal" },
    indicators: { type: [String], default: [] },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

ThreatSchema.index({ threatType: 1, severity: 1, isActive: 1 });

export const Threat = mongoose.model<IThreat>("Threat", ThreatSchema, "threats");
