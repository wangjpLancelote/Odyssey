import { ZodError, ZodSchema } from "zod";
import { NextResponse } from "next/server";

export async function parseJson<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const payload = await req.json();
  return schema.parse(payload);
}

export function requireSessionToken(req: Request): string {
  const token = req.headers.get("x-session-token");
  if (!token) {
    throw new Error("session_token_required");
  }
  return token;
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "validation_error",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    const isNotFound =
      error.message === "session_not_found" ||
      error.message === "choice_not_found" ||
      error.message === "checkpoint_not_found" ||
      error.message === "node_not_found" ||
      error.message === "next_node_not_found" ||
      error.message === "cutscene_not_found" ||
      error.message === "chapter_not_found";

    const isUnauthorized = error.message === "session_token_required" || error.message === "unauthorized_session";
    const isConflict = error.message === "name_conflict";
    const isServerError = error.message === "supabase_env_missing" || error.message === "supabase_query_failed";

    const status =
      isNotFound
        ? 404
        : isUnauthorized
          ? 401
          : isConflict
            ? 409
            : isServerError
                ? 503
                : 400;

    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ error: "unknown_error" }, { status: 500 });
}
