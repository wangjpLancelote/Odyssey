import { NextResponse } from "next/server";
import { z } from "zod";
import { chapterResourceManager } from "@/lib/server/chapter-resource-manager";
import { apiError } from "@/lib/server/http";
import { resolveAssetRef } from "@/lib/asset-resolver";

const querySchema = z.object({
  storylineId: z.string().default("fire-dawn"),
  chapterId: z.string().default("ch01")
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = querySchema.parse({
      storylineId: searchParams.get("storylineId") ?? undefined,
      chapterId: searchParams.get("chapterId") ?? undefined
    });

    const { assetManifest, criticalPreloadAssets } = await chapterResourceManager.getChapterAssets(
      params.storylineId,
      params.chapterId
    );

    const timelineVideoCueMap: Record<string, { src: string; poster?: string; loop?: boolean }> = {};
    for (const trigger of assetManifest.triggers.timelineCue) {
      const firstVideoId = trigger.videoIds[0];
      if (!firstVideoId) continue;

      const videoAsset = assetManifest.video.find((item) => item.id === firstVideoId);
      if (!videoAsset) continue;

      const src = resolveAssetRef({
        id: videoAsset.id,
        kind: "video",
        assetPath: videoAsset.path,
        storylineId: params.storylineId,
        chapterId: params.chapterId,
        baseKey: assetManifest.baseKey
      }).url;

      const poster = videoAsset.poster
        ? resolveAssetRef({
            id: `${videoAsset.id}:poster`,
            kind: "image",
            assetPath: videoAsset.poster,
            storylineId: params.storylineId,
            chapterId: params.chapterId,
            baseKey: assetManifest.baseKey
          }).url
        : undefined;

      timelineVideoCueMap[trigger.cueId] = {
        src,
        poster,
        loop: false
      };
    }

    return NextResponse.json({
      storylineId: params.storylineId,
      chapterId: params.chapterId,
      assetManifest,
      criticalPreloadAssets,
      timelineVideoCueMap
    });
  } catch (error) {
    return apiError(error);
  }
}
