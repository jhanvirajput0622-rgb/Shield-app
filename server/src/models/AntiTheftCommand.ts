import mongoose, { Document, Schema } from "mongoose";

export type CommandType = "Locate" | "Lock" | "Wipe";
export type CommandStatus = "Pending" | "Sent" | "Success" | "Failed";

export interface IAntiTheftCommand extends Document {
  _id: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  /** Issuing user — used for authorization */
  userId: mongoose.Types.ObjectId;
  commandType: CommandType;
  /** Optional message (used for Lock — displayed on locked screen) */
  message: string;
  status: CommandStatus;
  executed: boolean;
  issuedAt: Date;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AntiTheftCommandSchema = new Schema<IAntiTheftCommand>(
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
    commandType: {
      type: String,
      required: true,
      enum: ["Locate", "Lock", "Wipe"],
    },
    message: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Sent", "Success", "Failed"],
      default: "Pending",
    },
    executed: { type: Boolean, default: false },
    issuedAt: { type: Date, default: Date.now },
    executedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AntiTheftCommandSchema.index({ deviceId: 1, status: 1 });

export const AntiTheftCommand = mongoose.model<IAntiTheftCommand>(
  "AntiTheftCommand",
  AntiTheftCommandSchema,
  "anti_theft_commands"
);
