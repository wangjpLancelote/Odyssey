import { NextResponse } from "next/server";
import { playCutsceneRequestSchema } from "@odyssey/shared";
import { loadCompiledTimeline } from "@/lib/server/storyboard-repository";
import { cutsceneDslManifest } from "@/lib/cutscene-specs";
import { gameStore } from "@/lib/server/game-store";
import { apiError, parseJson, requireSessionToken } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    const token = requireSessionToken(req);
    const body = await parseJson(req, playCutsceneRequestSchema);
    if (!(body.cutsceneId in cutsceneDslManifest)) {
      return NextResponse.json({ error: "unsupported_cutscene" }, { status: 400 });
    }
    const cutsceneId = body.cutsceneId as keyof typeof cutsceneDslManifest;

    const context = gameStore.getCutsceneContext(
      body.sessionId,
      token,
      cutsceneId
    );

    const timeline = await loadCompiledTimeline({
      cutsceneId: context.cutsceneId,
      dayNight: context.dayNight,
      branchTag: context.branchTag
    });

    return NextResponse.json({
      cutsceneId: context.cutsceneId,
      sceneId: context.sceneId,
      timeline
    });
  } catch (error) {
    return apiError(error);
  }
}
