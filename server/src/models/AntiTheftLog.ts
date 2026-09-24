import mongoose, { Document, Schema } from "mongoose";

export interface IAntiTheftLog extends Document {
  _id: mongoose.Types.ObjectId;
  /** Device this log belongs to */
  deviceId: mongoose.Types.ObjectId;
  /** Owner — used for authorization checks */
  userId: mongoose.Types.ObjectId;
  /** WGS84 latitude — treat as sensitive PII */
  latitude: number;
  /** WGS84 longitude — treat as sensitive PII */
  longitude: number;
  /** GPS accuracy in metres */
  accuracy: number | null;
  batteryLevel: number | null; // 0-100
  /** "wifi" | "cellular" | "none" | "unknown" */
  networkType: string;
  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AntiTheftLogSchema = new Schema<IAntiTheftLog>(
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
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    batteryLevel: { type: Number, default: null, min: 0, max: 100 },
    networkType: { type: String, default: "unknown" },
    capturedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Most common access pattern: get recent logs for a device
AntiTheftLogSchema.index({ deviceId: 1, capturedAt: -1 });

export const AntiTheftLog = mongoose.model<IAntiTheftLog>(
  "AntiTheftLog",
  AntiTheftLogSchema,
  "anti_theft_logs"
);
