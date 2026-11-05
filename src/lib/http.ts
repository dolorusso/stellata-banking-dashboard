import "server-only";
import type { z } from "zod";
import type { ApiErrorBody } from "./schemas";

export function jsonError(status: number, error: ApiErrorBody["error"]) {
  return Response.json({ error } satisfies ApiErrorBody, { status });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Reads and validates a JSON body. Invalid input → 400 with field-level issues. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, { message: "Request body must be valid JSON", code: "INVALID_JSON" }) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(400, {
        message: "Invalid request",
        code: "VALIDATION_ERROR",
        issues: result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      }),
    };
  }
  return { ok: true, data: result.data };
}
