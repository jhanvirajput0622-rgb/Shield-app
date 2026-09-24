import mongoose, { Document, Schema } from "mongoose";

export interface IUserKey extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** Base64-encoded public key — safe to expose */
  publicKey: string;
  /**
   * AES-256-GCM encrypted private key blob.
   * Format: base64(iv [12 bytes] + ciphertext + authTag [16 bytes])
   * Encrypted with the server-side ENCRYPTION_KEY.
   * NEVER returned through normal API responses.
   */
  privateKeyEncrypted: string;
  keyCreatedAt: Date;
  keyUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserKeySchema = new Schema<IUserKey>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    privateKeyEncrypted: {
      type: String,
      required: true,
      select: false, // never returned in queries by default
    },
    keyCreatedAt: { type: Date, default: Date.now },
    keyUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);


export const UserKey = mongoose.model<IUserKey>("UserKey", UserKeySchema, "user_keys");
