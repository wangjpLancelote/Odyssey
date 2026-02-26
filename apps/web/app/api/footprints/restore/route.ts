import { NextResponse } from "next/server";
import { restoreFootprintRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, restoreFootprintRequestSchema);
    return NextResponse.json(await gameStore.restore(body.sessionId, token, body.checkpointId));
  } catch (error) {
    return apiError(error);
  }
}
