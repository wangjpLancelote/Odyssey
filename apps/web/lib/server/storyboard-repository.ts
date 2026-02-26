import type { CompiledSceneTimeline } from "@odyssey/shared";
import { chapterResourceManager } from "@/lib/server/chapter-resource-manager";

export async function loadCompiledTimeline(params: {
  storylineId: string;
  chapterId: string;
  cutsceneId?: string;
  dayNight: "DAY" | "NIGHT";
  branchTag?: string;
}): Promise<{ cutsceneId: string; sceneId: string; timeline: CompiledSceneTimeline }> {
  return chapterResourceManager.compileCutscene(params);
}
