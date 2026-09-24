import { z } from "zod";

export const registerDeviceSchema = z.object({
  body: z.object({
    deviceName: z.string().trim().min(1, "deviceName is required").max(100),
    platform: z.enum(["iOS", "Android"]).default("iOS"),
    osVersion: z.string().max(32).optional().default(""),
    appVersion: z.string().max(32).optional().default(""),
    deviceModel: z.string().max(64).optional().default(""),
    /**
     * SHA-256 (or similar) fingerprint of the device public key.
     * The raw private key NEVER leaves the device.
     */
    deviceKeyFingerprint: z.string().max(256).optional().default(""),
  }),
});

export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>["body"];
