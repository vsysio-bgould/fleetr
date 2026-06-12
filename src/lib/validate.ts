import type { ZodSchema } from "zod";
import { ValidationError } from "@/lib/errors";
import type { NextRequest } from "next/server";

/**
 * Parse and validate a JSON request body against a Zod schema.
 * Throws ValidationError (422) with field-level messages on failure.
 */
export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!fields[key]) fields[key] = [];
      fields[key].push(issue.message);
    }
    throw new ValidationError("Validation failed", fields);
  }

  return result.data;
}

/**
 * Parse and validate URL search params against a Zod schema.
 * Throws ValidationError (422) with field-level messages on failure.
 */
export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): T {
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      if (!fields[key]) fields[key] = [];
      fields[key].push(issue.message);
    }
    throw new ValidationError("Query validation failed", fields);
  }
  return result.data;
}
