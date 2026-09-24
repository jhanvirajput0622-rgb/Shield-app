import mongoose, { Document, Schema } from "mongoose";

export interface IInstalledApp extends Document {
  _id: mongoose.Types.ObjectId;
  /** Reference to the PermissionScan this app was found in */
  scanId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  appName: string;
  packageName: string;
  appVersion: string;
  developer: string;
  /** ISO string of when the app was first installed on the device */
  firstInstalledAt: Date | null;
  category: string;
  riskScore: number;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  riskReasons: string[];
  requestedPermissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

const InstalledAppSchema = new Schema<IInstalledApp>(
  {
    scanId: {
      type: Schema.Types.ObjectId,
      ref: "PermissionScan",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    appName: { type: String, required: true, trim: true },
    packageName: { type: String, required: true, trim: true, index: true },
    appVersion: { type: String, default: "" },
    developer: { type: String, default: "" },
    firstInstalledAt: { type: Date, default: null },
    category: { type: String, default: "unknown" },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ["safe", "low", "medium", "high", "critical"],
      default: "safe",
    },
    riskReasons: { type: [String], default: [] },
    requestedPermissions: { type: [String], default: [] },
  },
  { timestamps: true }
);

InstalledAppSchema.index({ scanId: 1, packageName: 1 });

export const InstalledApp = mongoose.model<IInstalledApp>(
  "InstalledApp",
  InstalledAppSchema,
  "installed_apps"
);
