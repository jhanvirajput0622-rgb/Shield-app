import { z } from "zod";

export const createUserKeySchema = z.object({
  body: z.object({
    publicKey: z.string().min(1, "publicKey is required"),
    privateKeyEncrypted: z.string().min(1, "privateKeyEncrypted is required"),
  }),
});

export type CreateUserKeyBody = z.infer<typeof createUserKeySchema>["body"];
