import { describe, expect, test } from "bun:test";
import { chapterResourceManager } from "./chapter-resource-manager";

describe("chapter-resource-manager", () => {
  test("loads chapter bundle independently", async () => {
    const ch01 = await chapterResourceManager.loadChapterBundle("fire-dawn", "ch01");
    const ch02 = await chapterResourceManager.loadChapterBundle("fire-dawn", "ch02");

    expect(ch01.meta.chapterId).toBe("ch01");
    expect(ch01.nodes["fd-ch01-node-01"]?.id).toBe("fd-ch01-node-01");
    expect(ch01.assetManifest.version).toBe("2");
    expect(ch01.assetManifest.audio.length).toBeGreaterThan(0);
    expect(ch01.criticalPreloadAssets.length).toBeGreaterThan(0);

    expect(ch02.meta.chapterId).toBe("ch02");
    expect(ch02.nodes["fd-ch02-node-01"]?.id).toBe("fd-ch02-node-01");
    expect(ch02.assetManifest.version).toBe("2");
    expect(ch02.assetManifest.video.length).toBeGreaterThan(0);
  });

  test("compiles chapter cutscene timeline", async () => {
    const compiled = await chapterResourceManager.compileCutscene({
      storylineId: "fire-dawn",
      chapterId: "ch01",
      dayNight: "DAY"
    });

    expect(compiled.cutsceneId).toBe("fire-dawn-ch01-cutscene-01");
    expect(compiled.timeline.sceneId).toBe("fd-ch01-scene-street");
    expect(compiled.timeline.motions.length).toBeGreaterThan(0);
  });
});
