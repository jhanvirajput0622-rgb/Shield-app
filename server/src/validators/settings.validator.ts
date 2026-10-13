import { z } from "zod";

export const updateSettingsSchema = z.object({
  body: z
    .object({
      webProtectionEnabled: z.boolean().optional(),
      vpnAutoConnect: z.boolean().optional(),
      killSwitchEnabled: z.boolean().optional(),
      notifyHighRiskApps: z.boolean().optional(),
      notifyPhishingThreats: z.boolean().optional(),
      notifyDeviceUnlock: z.boolean().optional(),
    })
    .refine(
      (data) => Object.keys(data).length > 0,
      { message: "At least one setting must be provided" }
    ),
});

export type UpdateSettingsBody = z.infer<typeof updateSettingsSchema>["body"];
