import type { Context } from "hono";
import type { z } from "zod";
import { UUID_REGEX } from "../../shared/uuid";
import { AppError } from "./errors";

/** Parses a JSON body with a Zod schema. Malformed JSON → 400, invalid → 400 with issues. */
export async function parseJsonBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError(400, "BAD_REQUEST", "Malformed JSON body");
  }
  return schema.parse(raw); // ZodError → VALIDATION_FAILED via errorHandler
}

/** Route `:id` params must be UUIDs; anything else is a 404 (no DB round-trip). */
export function parseIdParam(value: string | undefined): string {
  if (!value || !UUID_REGEX.test(value)) throw new AppError(404, "NOT_FOUND", "Resource not found");
  return value.toLowerCase();
}
