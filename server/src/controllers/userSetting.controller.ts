import { Request, Response } from "express";
import { UserSetting } from "../models/UserSetting";
import { ApiError } from "../utils/ApiError";
import { UpsertSettingBody, BatchUpsertBody } from "../validators/userSetting.validator";

export const userSettingController = {
  // GET /api/user-settings — all settings for authenticated user
  async listSettings(req: Request, res: Response): Promise<void> {
    const settings = await UserSetting.find({ userId: req.userId });

    const result: Record<string, unknown> = {};
    for (const s of settings) {
      try {
        result[s.settingKey] = JSON.parse(s.settingValue);
      } catch {
        result[s.settingKey] = s.settingValue;
      }
    }

    res.json({ success: true, data: result });
  },

  // PUT /api/user-settings/:key — upsert a single setting
  async upsertSetting(req: Request, res: Response): Promise<void> {
    const key = req.params["key"];
    const { settingValue } = req.body as UpsertSettingBody;

    await UserSetting.findOneAndUpdate(
      { userId: req.userId, settingKey: key },
      { $set: { settingValue } },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: { settingKey: key, settingValue } });
  },

  // POST /api/user-settings/batch — upsert multiple settings atomically
  async batchUpsert(req: Request, res: Response): Promise<void> {
    const { settings } = req.body as BatchUpsertBody;

    const ops = settings.map((s) => ({
      updateOne: {
        filter: { userId: req.userId, settingKey: s.settingKey },
        update: { $set: { settingValue: s.settingValue } },
        upsert: true,
      },
    }));

    await UserSetting.bulkWrite(ops);
    res.json({ success: true });
  },

  // DELETE /api/user-settings/:key
  async deleteSetting(req: Request, res: Response): Promise<void> {
    const key = req.params["key"];
    const deleted = await UserSetting.findOneAndDelete({
      userId: req.userId,
      settingKey: key,
    });
    if (!deleted) throw ApiError.notFound("Setting");
    res.json({ success: true });
  },
};
