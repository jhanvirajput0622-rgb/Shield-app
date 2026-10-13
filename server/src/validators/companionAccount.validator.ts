import { z } from "zod";

export const createCompanionSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email").toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128),
  }),
});

export const companionLoginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email").toLowerCase(),
    password: z.string().min(1, "Password required"),
  }),
});

export type CreateCompanionBody = z.infer<typeof createCompanionSchema>["body"];
export type CompanionLoginBody = z.infer<typeof companionLoginSchema>["body"];
