import { Request, Response } from "express";
import { Threat } from "../models/Threat";
import { ApiError } from "../utils/ApiError";

export const threatController = {
  // GET /api/threats — paginated list of active threats
  async listThreats(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query["page"]) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"]) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isActive: true };
    if (req.query["severity"]) filter["severity"] = req.query["severity"];
    if (req.query["threatType"]) filter["threatType"] = req.query["threatType"];

    const [threats, total] = await Promise.all([
      Threat.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit),
      Threat.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: threats,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  },

  // GET /api/threats/:id
  async getThreat(req: Request, res: Response): Promise<void> {
    const threat = await Threat.findById(req.params["id"]);
    if (!threat) throw ApiError.notFound("Threat");
    res.json({ success: true, data: threat });
  },
};
