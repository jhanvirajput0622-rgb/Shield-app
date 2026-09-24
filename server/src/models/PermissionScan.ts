import mongoose, { Document, Schema } from "mongoose";

export type OverallRisk = "Low" | "Medium" | "High";

export interface IPermissionScan extends Document {
  _id: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  scanTime: Date;
  overallRisk: OverallRisk;
  totalApps: number;
  riskyPermissionsFound: number;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionScanSchema = new Schema<IPermissionScan>(
  {
    deviceId: {
      type: Schema.Types.ObjectId,
      ref: "Device",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scanTime: { type: Date, default: Date.now },
    overallRisk: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    totalApps: { type: Number, default: 0 },
    riskyPermissionsFound: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PermissionScanSchema.index({ deviceId: 1, scanTime: -1 });

export const PermissionScan = mongoose.model<IPermissionScan>(
  "PermissionScan",
  PermissionScanSchema,
  "permission_scans"
);
