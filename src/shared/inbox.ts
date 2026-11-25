import { z } from "zod";

/** Only http(s) links are accepted: blocks `javascript:` / `data:` URLs (XSS when rendered). */
export const httpUrlSchema = z
  .url({ protocol: /^https?$/, hostname: z.regexes.domain })
  .max(2048);

export const createInboxItemSchema = z.object({
  content: z.string().trim().min(1, "Escreva algo para capturar").max(10_000),
  url: httpUrlSchema.optional(),
});

export const updateInboxItemSchema = z.object({
  processed: z.boolean(),
});

export const inboxListQuerySchema = z.object({
  status: z.enum(["open", "processed", "all"]).default("open"),
});

export type CreateInboxItemInput = z.infer<typeof createInboxItemSchema>;
export type UpdateInboxItemInput = z.infer<typeof updateInboxItemSchema>;
export type InboxStatusFilter = z.infer<typeof inboxListQuerySchema>["status"];

export interface InboxItem {
  id: string;
  content: string;
  url: string | null;
  processedAt: string | null;
  createdAt: string;
}
