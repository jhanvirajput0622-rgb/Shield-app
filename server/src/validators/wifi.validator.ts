import { z } from "zod";

export const checkWifiSchema = z.object({
  body: z.object({
    /** SHA-256 of the SSID — raw SSIDs must NOT be sent to the server */
    networkHash: z
      .string()
      .min(8, "networkHash must be at least 8 chars")
      .max(128),
    securityType: z
      .enum(["WPA3", "WPA2", "WPA", "WEP", "OPEN", "UNKNOWN"])
      .default("UNKNOWN"),
    signalStrength: z.number().min(-100).max(0).nullable().optional(),
  }),
});

export type CheckWifiBody = z.infer<typeof checkWifiSchema>["body"];
