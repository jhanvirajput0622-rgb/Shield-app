import mongoose, { Document, Schema } from "mongoose";

export interface ISettings extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  webProtectionEnabled: boolean;
  vpnAutoConnect: boolean;
  killSwitchEnabled: boolean;
  notifyHighRiskApps: boolean;
  notifyPhishingThreats: boolean;
  notifyDeviceUnlock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    webProtectionEnabled: { type: Boolean, default: true },
    vpnAutoConnect: { type: Boolean, default: false },
    killSwitchEnabled: { type: Boolean, default: false },
    notifyHighRiskApps: { type: Boolean, default: true },
    notifyPhishingThreats: { type: Boolean, default: true },
    notifyDeviceUnlock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>("Settings", SettingsSchema, "settings");
