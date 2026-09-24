import mongoose, { Document, Schema } from "mongoose";

export type PermissionType =
  | "Camera"
  | "Microphone"
  | "Location"
  | "Contacts"
  | "Storage"
  | "SMS"
  | "Phone"
  | "Notifications"
  | "Calendar"
  | "Biometric"
  | "Internet"
  | "Bluetooth"
  | "Other";

export type PermissionRiskLevel = "Low" | "Medium" | "High";

export interface IAppPermission extends Document {
  _id: mongoose.Types.ObjectId;
  appId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  permissionName: string;
  permissionType: PermissionType;
  riskLevel: PermissionRiskLevel;
  isDangerous: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AppPermissionSchema = new Schema<IAppPermission>(
  {
    appId: {
      type: Schema.Types.ObjectId,
      ref: "InstalledApp",
      required: true,
      // index defined below via schema.index()
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // index defined below via schema.index()
    },
    permissionName: { type: String, required: true, trim: true },
    permissionType: {
      type: String,
      required: true,
      enum: [
        "Camera",
        "Microphone",
        "Location",
        "Contacts",
        "Storage",
        "SMS",
        "Phone",
        "Notifications",
        "Calendar",
        "Biometric",
        "Internet",
        "Bluetooth",
        "Other",
      ],
      default: "Other",
    },
    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Low",
    },
    isDangerous: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AppPermissionSchema.index({ appId: 1 });

export const AppPermission = mongoose.model<IAppPermission>(
  "AppPermission",
  AppPermissionSchema,
  "app_permissions"
);
