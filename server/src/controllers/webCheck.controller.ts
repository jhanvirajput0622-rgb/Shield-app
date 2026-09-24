import { Request, Response } from "express";
import { PhishingCheck } from "../models/PhishingCheck";
import { ApiError } from "../utils/ApiError";

export const webCheckController = {
  // GET /api/web-checks — list all web checks for the authenticated user
  async listChecks(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query["page"]) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query["limit"]) || 20));
    const skip = (page - 1) * limit;

    const [checks, total] = await Promise.all([
      PhishingCheck.find({ userId: req.userId })
        .sort({ checkedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-encryptedUrl"), // Never expose encrypted URL blob
      PhishingCheck.countDocuments({ userId: req.userId }),
    ]);

    res.json({
      success: true,
      data: checks.map((c) => ({
        id: c._id.toString(),
        domain: c.domain,
        verdict: c.verdict,
        threatType: c.threatType,
        source: c.source,
        checkedAt: c.checkedAt.toISOString(),
      })),
      meta: { total, page, limit },
    });
  },

  // GET /api/web-checks/:id
  async getCheck(req: Request, res: Response): Promise<void> {
    const check = await PhishingCheck.findOne({
      _id: req.params["id"],
      userId: req.userId, // Ownership enforced
    }).select("-encryptedUrl");

    if (!check) throw ApiError.notFound("WebCheck");

    res.json({
      success: true,
      data: {
        id: check._id.toString(),
        domain: check.domain,
        verdict: check.verdict,
        threatType: check.threatType,
        source: check.source,
        checkedAt: check.checkedAt.toISOString(),
      },
    });
  },
};
