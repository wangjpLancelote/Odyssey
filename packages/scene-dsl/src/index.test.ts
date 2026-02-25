import { describe, expect, test } from "bun:test";
import { compileSceneTimeline } from "./index";

describe("scene dsl compiler", () => {
  test("compiles modules with offsets", () => {
    const timeline = compileSceneTimeline({
      context: { dayNight: "DAY" },
      modules: [
        {
          moduleId: "m1",
          motions: [
            {
              id: "cam",
              kind: "camera",
              target: "camera.main",
              atMs: 0,
              durationMs: 100,
              priority: 0,
              ease: "power1.out",
              from: { x: 0 },
              to: { x: 10 }
            }
          ],
          audios: []
        }
      ],
      plan: {
        dslVersion: "1",
        sceneId: "scene-1",
        cutsceneId: "cutscene-1",
        instances: [
          {
            instanceId: "i1",
            moduleId: "m1",
            offsetMs: 200,
            overrides: []
          }
        ]
      }
    });

    expect(timeline.motions[0].atMs).toBe(200);
    expect(timeline.motions[0].id).toBe("i1:cam");
  });
});
