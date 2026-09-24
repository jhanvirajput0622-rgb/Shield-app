import mongoose, { Document, Schema } from "mongoose";

/**
 * DeviceLocation — point-in-time GPS snapshot for a device.
 *
 * PRIVACY:
 *   - Only stored when the owning user explicitly triggers a locate command.
 *   - A TTL index automatically purges records older than 30 days.
 *   - Historical location data is never retained indefinitely.
 *   - Precise coordinates (lat/lng) must only be transmitted over HTTPS.
 */
export interface IDeviceLocation extends Document {
  _id: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  latitude: number;
  longitude: number;
  /** Accuracy radius in metres */
  accuracy: number | null;
  /** ISO-8601 timestamp from the device GPS fix */
  recordedAt: Date;
  createdAt: Date;
}

const DeviceLocationSchema = new Schema<IDeviceLocation>(
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
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    accuracy: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for efficient per-device timeline queries
DeviceLocationSchema.index({ deviceId: 1, recordedAt: -1 });

// 30-day retention — MongoDB will auto-delete older documents
DeviceLocationSchema.index(
  { recordedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const DeviceLocation = mongoose.model<IDeviceLocation>(
  "DeviceLocation",
  DeviceLocationSchema,
  "device_locations"
);
