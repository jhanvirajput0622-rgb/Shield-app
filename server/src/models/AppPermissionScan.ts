import mongoose, { Document, Schema } from "mongoose";

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface IAppFinding {
  appName: string;
  packageName: string;
  category: string;
  requestedPermissions: string[];
  riskScore: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
}

export interface IAppPermissionScan extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  apps: IAppFinding[];
  totalApps: number;
  highRiskCount: number;
  scannedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AppFindingSchema = new Schema<IAppFinding>(
  {
    appName: { type: String, required: true },
    packageName: { type: String, required: true },
    category: { type: String, default: "unknown" },
    requestedPermissions: { type: [String], default: [] },
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ["safe", "low", "medium", "high", "critical"],
      default: "safe",
    },
    riskReasons: { type: [String], default: [] },
  },
  { _id: false }
);

const AppPermissionScanSchema = new Schema<IAppPermissionScan>(
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
    apps: { type: [AppFindingSchema], default: [] },
    totalApps: { type: Number, default: 0 },
    highRiskCount: { type: Number, default: 0 },
    scannedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AppPermissionScanSchema.index({ userId: 1, scannedAt: -1 });

export const AppPermissionScan = mongoose.model<IAppPermissionScan>(
  "AppPermissionScan",
  AppPermissionScanSchema,
  "app_permission_scans"
);
