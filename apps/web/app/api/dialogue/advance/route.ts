import { NextResponse } from "next/server";
import { advanceDialogueRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, advanceDialogueRequestSchema);
    const result = gameStore.getNode(body.sessionId, token);
    if (!result) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
