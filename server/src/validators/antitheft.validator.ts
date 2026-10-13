import { z } from "zod";

export const lockDeviceSchema = z.object({
  body: z.object({
    message: z
      .string()
      .min(1, "Lock message is required")
      .max(200, "Lock message too long"),
  }),
});

export const wipeDeviceSchema = z.object({
  body: z.object({
    confirmationPhrase: z
      .string()
      .min(1, "Confirmation phrase is required")
      .max(100),
  }),
});

export const locateDeviceSchema = z.object({
  body: z
    .object({
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      accuracy: z.number().min(0).optional(),
    })
    .optional(),
});

export const registerDeviceSchema = z.object({
  body: z.object({
    deviceName: z.string().trim().min(1).max(100),
    platform: z.enum(["iOS", "Android"]).default("iOS"),
    osVersion: z.string().max(32).optional().default(""),
    appVersion: z.string().max(32).optional().default(""),
    model: z.string().max(64).optional().default(""),
    publicKey: z.string().max(2048).optional().default(""),
  }),
});

export type LockDeviceBody = z.infer<typeof lockDeviceSchema>["body"];
export type WipeDeviceBody = z.infer<typeof wipeDeviceSchema>["body"];
export type RegisterDeviceBody = z.infer<typeof registerDeviceSchema>["body"];
