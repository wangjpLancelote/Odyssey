import { NextResponse } from "next/server";
import { chapterEnterRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, chapterEnterRequestSchema);
    const payload = await gameStore.enterChapter(body.sessionId, token, body.toChapterId);
    return NextResponse.json(payload);
  } catch (error) {
    return apiError(error);
  }
}
