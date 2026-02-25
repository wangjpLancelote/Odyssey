import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/server/game-store";
import { apiError } from "@/lib/server/http";

export function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const token = req.headers.get("x-session-token");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId_required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "session_token_required" }, { status: 401 });
    }

    return NextResponse.json(gameStore.footprintMap(sessionId, token));
  } catch (error) {
    return apiError(error);
  }
}
