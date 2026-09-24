import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface ICompanionAccount extends Document {
  _id: mongoose.Types.ObjectId;
  /** Primary user this companion account belongs to */
  userId: mongoose.Types.ObjectId;
  email: string;
  /** bcrypt hash — NEVER exposed through API responses */
  passwordHash: string;
  twoFactorEnabled: boolean;
  lastLoginAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const CompanionAccountSchema = new Schema<ICompanionAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One companion account per user
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    twoFactorEnabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret["passwordHash"];
        return ret;
      },
    },
  }
);

CompanionAccountSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash as string);
};

export const CompanionAccount = mongoose.model<ICompanionAccount>(
  "CompanionAccount",
  CompanionAccountSchema,
  "companion_accounts"
);
