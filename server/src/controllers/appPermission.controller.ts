import { Request, Response } from "express";
import { AppPermission } from "../models/AppPermission";
import { ApiError } from "../utils/ApiError";

export const appPermissionController = {
  // GET /api/app-permissions?appId=...
  async listPermissions(req: Request, res: Response): Promise<void> {
    const filter: Record<string, unknown> = { userId: req.userId };
    if (req.query["appId"]) filter["appId"] = req.query["appId"];

    const perms = await AppPermission.find(filter).sort({ isDangerous: -1 });
    res.json({ success: true, data: perms });
  },

  // GET /api/app-permissions/:id
  async getPermission(req: Request, res: Response): Promise<void> {
    const perm = await AppPermission.findOne({
      _id: req.params["id"],
      userId: req.userId,
    });
    if (!perm) throw ApiError.notFound("AppPermission");
    res.json({ success: true, data: perm });
  },
};
