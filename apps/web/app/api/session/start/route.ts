import { NextResponse } from "next/server";
import { startSessionRequestSchema } from "@odyssey/shared";
import { NameConflictError, gameStore } from "@/lib/server/game-store";
import { apiError, parseJson } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const body = await parseJson(req, startSessionRequestSchema);
    const result = await gameStore.startSession(body.displayName, body.storylineId, body.chapterId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NameConflictError) {
      return NextResponse.json({ error: "name_conflict", suggestions: error.suggestions }, { status: 409 });
    }
    return apiError(error);
  }
}
