import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  /** Full name supplied at registration */
  name: string;
  /** E.164 format e.g. +911234567890 — unique when provided */
  phoneNumber: string | null;
  /** Google OAuth subject (sub) — unique when provided */
  googleSub: string | null;
  role: "user" | "admin";
  protectionScore: number;
  isActive: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Instance method — never returns the hash in the response */
  comparePassword(candidate: string): Promise<boolean>;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const UserSchema = new Schema<IUser>(
  {
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
    displayName: {
      type: String,
      default: "",
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    phoneNumber: {
      type: String,
      default: null,
      // Sparse unique index is defined below via schema.index() — not here
    },
    googleSub: {
      type: String,
      default: null,
      // Sparse unique index is defined below via schema.index() — not here
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    protectionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // Don't expose secret in queries by default
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        // Strip secret fields from serialised responses
        delete ret["passwordHash"];
        return ret;
      },
    },
  }
);

// Sparse unique index on phoneNumber — allows multiple null but enforces uniqueness on values
UserSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

// Sparse unique index on googleSub — allows multiple null but enforces uniqueness on values
UserSchema.index({ googleSub: 1 }, { unique: true, sparse: true });

// ─── Instance method ──────────────────────────────────────────────────────────

UserSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash as string);
};

// ─── Static helper — hash a plain-text password ───────────────────────────────

UserSchema.statics.hashPassword = async function (
  plain: string
): Promise<string> {
  return bcrypt.hash(plain, 12);
};

export const User = mongoose.model<IUser>("User", UserSchema, "users");
