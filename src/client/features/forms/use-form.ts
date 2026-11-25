import { useState } from "react";
import type { z } from "zod";

/**
 * Minimal form state + validation with a shared Zod schema (the same schema
 * the API uses). Returns field errors keyed by the first path segment.
 */
export function useZodForm<S extends z.ZodType, F extends Record<string, unknown>>(schema: S, initial: F, toInput: (f: F) => unknown) {
  const [values, setValues] = useState<F>(initial);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const set = <K extends keyof F>(k: K, v: F[K]) => {
    setValues((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: undefined }));
  };
  const validate = (): z.infer<S> | null => {
    const parsed = schema.safeParse(toInput(values));
    if (parsed.success) return parsed.data;
    const errs: Record<string, string> = {};
    for (const issue of parsed.error.issues) errs[String(issue.path[0] ?? "_")] ??= issue.message;
    setErrors(errs);
    return null;
  };
  return { values, set, errors, validate };
}
