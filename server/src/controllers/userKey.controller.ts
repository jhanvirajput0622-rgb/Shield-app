import { Request, Response } from "express";
import { UserKey } from "../models/UserKey";
import { ApiError } from "../utils/ApiError";
import { CreateUserKeyBody } from "../validators/userKey.validator";

export const userKeyController = {
  // GET /api/user-keys — list public keys for authenticated user
  async listKeys(req: Request, res: Response): Promise<void> {
    // Never return privateKeyEncrypted — rely on schema select:false default
    const keys = await UserKey.find({ userId: req.userId })
      .sort({ keyCreatedAt: -1 });

    res.json({
      success: true,
      data: keys.map((k) => ({
        id: k._id.toString(),
        publicKey: k.publicKey,
        keyCreatedAt: k.keyCreatedAt.toISOString(),
        keyUpdatedAt: k.keyUpdatedAt.toISOString(),
        createdAt: k.createdAt.toISOString(),
      })),
    });
  },

  // POST /api/user-keys — store a new key pair
  async createKey(req: Request, res: Response): Promise<void> {
    const { publicKey, privateKeyEncrypted } = req.body as CreateUserKeyBody;

    const key = await UserKey.create({
      userId: req.userId,
      publicKey,
      privateKeyEncrypted,
      keyCreatedAt: new Date(),
      keyUpdatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: {
        id: key._id.toString(),
        publicKey: key.publicKey,
        keyCreatedAt: key.keyCreatedAt.toISOString(),
        createdAt: key.createdAt.toISOString(),
      },
    });
  },

  // DELETE /api/user-keys/:id
  async deleteKey(req: Request, res: Response): Promise<void> {
    const key = await UserKey.findOneAndDelete({
      _id: req.params["id"],
      userId: req.userId, // Ownership enforced — users can only delete their own keys
    });

    if (!key) throw ApiError.notFound("UserKey");
    res.json({ success: true });
  },
};
