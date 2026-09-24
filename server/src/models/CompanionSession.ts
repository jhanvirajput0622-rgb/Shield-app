import mongoose, { Document, Schema } from "mongoose";

export interface ICompanionSession extends Document {
  _id: mongoose.Types.ObjectId;
  companionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  loginTime: Date;
  logoutTime: Date | null;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanionSessionSchema = new Schema<ICompanionSession>(
  {
    companionId: {
      type: Schema.Types.ObjectId,
      ref: "CompanionAccount",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    loginTime: { type: Date, default: Date.now },
    logoutTime: { type: Date, default: null },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

CompanionSessionSchema.index({ companionId: 1, loginTime: -1 });

export const CompanionSession = mongoose.model<ICompanionSession>(
  "CompanionSession",
  CompanionSessionSchema,
  "companion_sessions"
);
