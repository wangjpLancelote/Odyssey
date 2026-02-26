import { NextRequest, NextResponse } from "next/server";
import { chapterTimelineRequestSchema } from "@odyssey/shared";
import { gameStore } from "@/lib/server/game-store";
import { apiError } from "@/lib/server/http";

export async function GET(req: NextRequest) {
  try {
    const storylineId = req.nextUrl.searchParams.get("storylineId") ?? undefined;
    const query = chapterTimelineRequestSchema.parse({ storylineId });
    const timeline = await gameStore.getChapterTimeline(query.storylineId);
    return NextResponse.json(timeline);
  } catch (error) {
    return apiError(error);
  }
}
