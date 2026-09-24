import { z } from "zod";

export const markReadSchema = z.object({
  body: z.object({
    ids: z.array(z.string()).min(1, "At least one notification id required"),
  }),
});

export type MarkReadBody = z.infer<typeof markReadSchema>["body"];
