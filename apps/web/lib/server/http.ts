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
    const status =
      error.message === "session_not_found" ||
      error.message === "choice_not_found" ||
      error.message === "checkpoint_not_found"
        ? 404
        : error.message === "session_token_required" || error.message === "unauthorized_session"
          ? 401
          : error.message === "name_conflict"
            ? 409
            : 400;

    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ error: "unknown_error" }, { status: 500 });
}
