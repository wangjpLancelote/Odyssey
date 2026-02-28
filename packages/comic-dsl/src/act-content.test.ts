import { describe, expect, test } from "bun:test";
import { comicBubbleThemeSchema } from "@odyssey/shared";
import { loadComicActBundle, prepareComicStoryboardPlan, resolveComicActId } from "./act-content";

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
    expect(prepared.bubbleTheme.themeId).toContain("fd-ch01");
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
});
