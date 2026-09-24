import mongoose, { Document, Schema } from "mongoose";

/**
 * Key-value user settings store.
 *
 * Canonical keys:
 *   notifications_enabled | dark_mode | vpn_auto_connect
 *   threat_alerts | location_tracking | biometric_lock
 *
 * Access pattern: always fetch ALL settings for a user at once,
 * so we use one document per key (flexible schema) with a compound
 * unique index on (userId, settingKey).
 *
 * NOTE: The existing Settings model stores the primary boolean flags.
 * UserSetting supplements it with arbitrary extensible key-value pairs
 * (feature flags, UI preferences, etc.) without schema changes.
 */
export interface IUserSetting extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  settingKey: string;
  settingValue: string; // JSON-serialised value — preserves type flexibility
  createdAt: Date;
  updatedAt: Date;
}

const UserSettingSchema = new Schema<IUserSetting>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    settingKey: {
      type: String,
      required: true,
      trim: true,
    },
    settingValue: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Unique compound index — one value per key per user
UserSettingSchema.index({ userId: 1, settingKey: 1 }, { unique: true });

export const UserSetting = mongoose.model<IUserSetting>(
  "UserSetting",
  UserSettingSchema,
  "user_settings"
);
