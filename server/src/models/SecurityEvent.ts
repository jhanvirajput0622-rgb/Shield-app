import mongoose, { Document, Schema } from "mongoose";

export type EventSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ISecurityEvent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId | null;
  eventType: string;
  severity: EventSeverity;
  title: string;
  description: string;
  metadata: Record<string, unknown>;
  /** True if the event represents a blocked/stopped threat */
  isBlocked: boolean;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SecurityEventSchema = new Schema<ISecurityEvent>(
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
      default: null,
    },
    eventType: { type: String, required: true },
    severity: {
      type: String,
      enum: ["info", "low", "medium", "high", "critical"],
      default: "info",
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isBlocked: { type: Boolean, default: false },
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SecurityEventSchema.index({ userId: 1, occurredAt: -1 });
SecurityEventSchema.index({ userId: 1, severity: 1 });

export const SecurityEvent = mongoose.model<ISecurityEvent>(
  "SecurityEvent",
  SecurityEventSchema,
  "security_events"
);
