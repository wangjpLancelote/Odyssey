import { NextResponse } from "next/server";
import { recallSessionRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const body = await parseJson(req, recallSessionRequestSchema);
    const result = await gameStore.recallSession(body.displayName);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "name_not_found") {
      return NextResponse.json({ error: "name_not_found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "no_active_session") {
      return NextResponse.json({ error: "no_active_session" }, { status: 409 });
    }
    return apiError(error);
  }
}
