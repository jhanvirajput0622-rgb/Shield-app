import mongoose, { Document, Schema } from "mongoose";

/**
 * TheftCommand — represents a remote command issued by a user to a device.
 *
 * Lifecycle:
 *   pending → sent → acknowledged → completed
 *   pending → failed          (delivery failure)
 *   Any state → expired       (TTL exceeded before completion)
 *
 * SECURITY:
 *   - The `wipe` command requires additional verification at the controller
 *     level before a TheftCommand is created.
 *   - Only the owning user (userId) may issue commands for a device.
 */
export type TheftCommandType = "locate" | "lock" | "wipe";
export type TheftCommandStatus =
  | "pending"
  | "sent"
  | "acknowledged"
  | "completed"
  | "failed"
  | "expired";

export interface ITheftCommand extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  command: TheftCommandType;
  /** Optional human-readable message displayed on a locked device */
  message: string;
  status: TheftCommandStatus;
  issuedAt: Date;
  acknowledgedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TheftCommandSchema = new Schema<ITheftCommand>(
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
      index: true,
    },
    command: {
      type: String,
      enum: ["locate", "lock", "wipe"],
      required: true,
    },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "sent", "acknowledged", "completed", "failed", "expired"],
      default: "pending",
      index: true,
    },
    issuedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    // Default TTL: 24 hours from issuance
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

// Fast pending-command lookup for a device (polled by mobile client)
TheftCommandSchema.index({ deviceId: 1, status: 1 });
TheftCommandSchema.index({ userId: 1, deviceId: 1 });

// TTL index — auto-expire documents after expiresAt
TheftCommandSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TheftCommand = mongoose.model<ITheftCommand>(
  "TheftCommand",
  TheftCommandSchema,
  "theft_commands"
);
