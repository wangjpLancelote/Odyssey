import { NextResponse } from "next/server";
import { triggerSideQuestRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, triggerSideQuestRequestSchema);
    const result = await gameStore.triggerSideQuest(body.sessionId, token);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
