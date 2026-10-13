import { z } from "zod";

export const upsertSettingSchema = z.object({
  body: z.object({
    settingKey: z.string().trim().min(1, "settingKey required").max(128),
    settingValue: z.string().max(4096),
  }),
});

export const batchUpsertSchema = z.object({
  body: z.object({
    settings: z
      .array(
        z.object({
          settingKey: z.string().trim().min(1).max(128),
          settingValue: z.string().max(4096),
        })
      )
      .min(1),
  }),
});

export type UpsertSettingBody = z.infer<typeof upsertSettingSchema>["body"];
export type BatchUpsertBody = z.infer<typeof batchUpsertSchema>["body"];
