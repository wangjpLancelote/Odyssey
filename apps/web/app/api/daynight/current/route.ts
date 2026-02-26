import { NextRequest, NextResponse } from "next/server";
import { gameStore } from "@/lib/server/game-store";
import { apiError } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const token = req.headers.get("x-session-token");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId_required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "session_token_required" }, { status: 401 });
    }

    const dayNight = await gameStore.getDayNight(sessionId, token);
    return NextResponse.json({ dayNight });
  } catch (error) {
    return apiError(error);
  }
}
