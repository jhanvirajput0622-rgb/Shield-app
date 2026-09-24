import { Request, Response } from "express";
import { settingsService } from "../services/settings.service";
import { auditService } from "../services/audit.service";
import { UpdateSettingsBody } from "../validators/settings.validator";

export const settingsController = {
  async getSettings(req: Request, res: Response): Promise<void> {
    const settings = await settingsService.getSettings(req.userId);
    res.json(settings);
  },

  async updateSettings(req: Request, res: Response): Promise<void> {
    const patch = req.body as UpdateSettingsBody;
    const settings = await settingsService.updateSettings(req.userId, patch);

    auditService.log(req.userId, "SETTINGS_UPDATED", "User settings updated", {
      metadata: { changedKeys: Object.keys(patch) },
    }).catch(() => {});

    res.json(settings);
  },
};
