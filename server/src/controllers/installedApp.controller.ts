import { Request, Response } from "express";
import { InstalledApp } from "../models/InstalledApp";
import { AppPermission } from "../models/AppPermission";
import { ApiError } from "../utils/ApiError";

export const installedAppController = {
  // GET /api/installed-apps?scanId=...
  async listApps(req: Request, res: Response): Promise<void> {
    const filter: Record<string, unknown> = { userId: req.userId };
    if (req.query["scanId"]) filter["scanId"] = req.query["scanId"];

    const apps = await InstalledApp.find(filter)
      .sort({ riskScore: -1 })
      .limit(200);

    res.json({ success: true, data: apps });
  },

  // GET /api/installed-apps/:id
  async getApp(req: Request, res: Response): Promise<void> {
    const app = await InstalledApp.findOne({
      _id: req.params["id"],
      userId: req.userId,
    });
    if (!app) throw ApiError.notFound("InstalledApp");
    res.json({ success: true, data: app });
  },
};
