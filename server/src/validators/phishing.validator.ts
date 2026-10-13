import { z } from "zod";

const urlCheckBase = z.object({
  urlHash: z
    .string()
    .min(8, "urlHash must be at least 8 chars")
    .max(128, "urlHash too long"),
  domain: z
    .string()
    .min(1, "domain is required")
    .max(253, "domain too long")
    .toLowerCase(),
  encryptedUrl: z.string().max(4096).optional(),
});

export const checkUrlSchema = z.object({
  body: urlCheckBase.extend({
    source: z
      .enum(["manual_check", "auto_scan", "sms", "qr"])
      .default("manual_check"),
  }),
});

/** QR checks are the same shape but always source=qr */
export const checkQrSchema = z.object({
  body: urlCheckBase.extend({
    source: z.literal("qr").default("qr"),
  }),
});

export type CheckUrlBody = z.infer<typeof checkUrlSchema>["body"];
export type CheckQrBody = z.infer<typeof checkQrSchema>["body"];
