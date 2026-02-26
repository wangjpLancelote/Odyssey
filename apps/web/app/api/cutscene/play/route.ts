import { NextResponse } from "next/server";
import { playCutsceneRequestSchema } from "@odyssey/shared";
import { loadCompiledTimeline } from "@/lib/server/storyboard-repository";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, playCutsceneRequestSchema);
    const context = await gameStore.getCutsceneContext(body.sessionId, token, body.cutsceneId);

    const timeline = await loadCompiledTimeline({
      storylineId: context.storylineId,
      chapterId: context.chapterId,
      cutsceneId: context.cutsceneId,
      dayNight: context.dayNight,
      branchTag: context.branchTag
    });

    return NextResponse.json({
      cutsceneId: timeline.cutsceneId,
      sceneId: timeline.sceneId,
      timeline: timeline.timeline
    });
  } catch (error) {
    return apiError(error);
  }
}
