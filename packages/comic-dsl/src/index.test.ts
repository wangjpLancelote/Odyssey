import { describe, expect, test } from "bun:test";
import { compileComicSequence } from "./index";

describe("comic dsl compiler", () => {
  const basePlan = {
    dslVersion: "1" as const,
    sequenceId: "seq-1",
    sourceType: "dialogue_node" as const,
    style: "hero_bright" as const,
    beats: [
      {
        beatId: "b1",
        text: "晨雾破开，少年踏出第一步。",
        sceneId: "fd-ch01-scene-street",
        emphasis: 0.3
      },
      {
        beatId: "b2",
        text: "钟声炸响，命运开始追上他。",
        sceneId: "fd-ch01-scene-belltower",
        emphasis: 0.85
      }
    ],
    rules: {
      panelCountMin: 2,
      panelCountMax: 4,
      readingOrder: "ltr_ttb" as const
    }
  };

  test("compiles deterministically with same input", () => {
    const a = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", sourceFingerprint: "fp-1" }
    });
    const b = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", sourceFingerprint: "fp-1" }
    });

    expect(a.meta.sourceHash).toBe(b.meta.sourceHash);
    expect(a.panels.length).toBe(2);
  });

  test("changes output hash when dayNight differs", () => {
    const day = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", sourceFingerprint: "fp-1" }
    });
    const night = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "NIGHT", sourceFingerprint: "fp-1" }
    });

    expect(day.meta.sourceHash).not.toBe(night.meta.sourceHash);
    expect(day.panels[0]?.paletteToken).not.toBe(night.panels[0]?.paletteToken);
  });

  test("changes output hash when branchTag differs", () => {
    const a = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", branchTag: "alpha", sourceFingerprint: "fp-1" }
    });
    const b = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", branchTag: "beta", sourceFingerprint: "fp-1" }
    });

    expect(a.meta.sourceHash).not.toBe(b.meta.sourceHash);
  });

  test("respects panel count limits and index ordering", () => {
    const plan = {
      ...basePlan,
      beats: [
        ...basePlan.beats,
        {
          beatId: "b3",
          text: "乌云压顶，风暴接近。",
          sceneId: "fd-ch01-scene-bridge",
          emphasis: 0.4
        },
        {
          beatId: "b4",
          text: "旧日的誓约在耳边回响。",
          sceneId: "fd-ch01-scene-lane",
          emphasis: 0.5
        },
        {
          beatId: "b5",
          text: "刀光与火焰切开夜色。",
          sceneId: "fd-ch01-scene-gate",
          emphasis: 0.9
        }
      ],
      rules: {
        panelCountMin: 2,
        panelCountMax: 4,
        readingOrder: "ltr_ttb" as const
      }
    };

    const compiled = compileComicSequence({
      plan,
      context: { dayNight: "NIGHT", sourceFingerprint: "fp-2" }
    });

    expect(compiled.panels.length).toBe(4);
    expect(compiled.panels.map((panel) => panel.index)).toEqual([0, 1, 2, 3]);
  });

  test("applies panel hints and emits render meta", () => {
    const compiled = compileComicSequence({
      plan: basePlan,
      context: { dayNight: "DAY", sourceFingerprint: "fp-3" },
      panelHints: [
        {
          panelId: "hinted-b1",
          index: 0,
          title: "提示标题",
          text: "提示正文",
          speech: [
            {
              speaker: "旁白",
              text: "提示对白",
              bubbleStyle: "whisper",
              anchor: { x: 0.2, y: 0.2 }
            }
          ]
        }
      ],
      metadata: {
        storylineId: "fire-dawn",
        chapterId: "ch01",
        nodeId: "fd-ch01-node-01",
        actId: "act-01",
        bubbleThemeId: "fd-ch01-dawn-heroic"
      }
    });

    expect(compiled.storylineId).toBe("fire-dawn");
    expect(compiled.chapterId).toBe("ch01");
    expect(compiled.nodeId).toBe("fd-ch01-node-01");
    expect(compiled.meta.actId).toBe("act-01");
    expect(compiled.meta.bubbleThemeId).toBe("fd-ch01-dawn-heroic");
    expect(compiled.panels[0]?.panelId).toBe("hinted-b1");
    expect(compiled.panels[0]?.speech[0]?.bubbleStyle).toBe("whisper");
    expect(compiled.panels[0]?.speech[0]?.renderHint).toBeDefined();
  });
});
