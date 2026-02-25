import { NextResponse } from "next/server";
import { commitChoiceRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, commitChoiceRequestSchema);
    const result = gameStore.commitChoice(body.sessionId, token, body.choiceId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
