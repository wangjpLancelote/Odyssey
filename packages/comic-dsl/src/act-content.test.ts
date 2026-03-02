import { describe, expect, test } from "bun:test";
import { comicBubbleThemeSchema } from "@odyssey/shared";
import { loadChapterActMap, loadComicActBundle, prepareComicStoryboardPlan, resolveComicActId } from "./act-content";

describe("comic act content", () => {
  test("resolves intro and node act ids from chapter map", async () => {
    const introAct = await resolveComicActId({
      storylineId: "fire-dawn",
      chapterId: "ch01",
      sourceType: "chapter_intro"
    });
    const nodeAct = await resolveComicActId({
      storylineId: "fire-dawn",
      chapterId: "ch01",
      sourceType: "dialogue_node",
      nodeId: "fd-ch01-node-03"
    });

    expect(introAct).toBe("act-01");
    expect(nodeAct).toBe("act-02");
  });

  test("builds storyboard plan from act content and injects node text", async () => {
    const prepared = await prepareComicStoryboardPlan({
      storylineId: "fire-dawn",
      chapterId: "ch01",
      sourceType: "dialogue_node",
      nodeId: "fd-ch01-node-02",
      sceneId: "fd-ch01-scene-porch",
      nodeText: "现在转身当然来得及，但门后的答案会追你一生。",
      sequenceId: "comic:fire-dawn:ch01:fd-ch01-node-02"
    });

    expect(prepared.actId).toBe("act-02");
    expect(prepared.bubbleTheme.themeId).toContain("ch01");
    expect(prepared.plan.beats[0]?.text).toContain("门后的答案");
    expect(prepared.plan.rules.readingOrder).toBe("ltr_ttb");
  });

  test("validates act bubble theme contract", async () => {
    const bundle = await loadComicActBundle({
      storylineId: "fire-dawn",
      chapterId: "ch02",
      actId: "act-01"
    });

    expect(bundle.bubbleTheme.themeId).toBeTruthy();
    expect(() =>
      comicBubbleThemeSchema.parse({
        ...bundle.bubbleTheme,
        constraints: {
          ...bundle.bubbleTheme.constraints,
          maxLines: 0
        }
      })
    ).toThrow();
  });

  test("covers chapter act maps from ch01 to ch12", async () => {
    for (let i = 1; i <= 12; i += 1) {
      const chapterId = `ch${String(i).padStart(2, "0")}`;
      const map = await loadChapterActMap("fire-dawn", chapterId);
      expect(map.introActId).toBeTruthy();
      expect(map.defaultActId).toBeTruthy();

      const actIds = new Set<string>([map.introActId, map.defaultActId, ...Object.values(map.nodeToAct)]);
      expect(actIds.size).toBeGreaterThan(0);

      for (const actId of actIds) {
        const bundle = await loadComicActBundle({
          storylineId: "fire-dawn",
          chapterId,
          actId
        });
        expect(bundle.schema.chapterId).toBe(chapterId);
        expect(bundle.storyboard.panelHints.length).toBeGreaterThan(0);
      }
    }
  });
});
