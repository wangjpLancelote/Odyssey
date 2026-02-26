import { describe, expect, test } from "bun:test";
import { ChapterRegistry, ChapterTimelineError } from "./chapter-registry";

describe("ChapterRegistry", () => {
  test("validates and exposes next chapter", () => {
    const registry = new ChapterRegistry({
      storylineId: "fire-dawn",
      chapters: [
        { id: "ch01", order: 1, prevId: null, nextId: "ch02", enabled: true, title: "第一章" },
        { id: "ch02", order: 2, prevId: "ch01", nextId: null, enabled: true, title: "第二章" }
      ]
    });

    expect(registry.canStartAt("ch01")).toBe(true);
    expect(registry.getNextChapter("ch01")?.id).toBe("ch02");
    expect(registry.canEnterNext("ch01", "ch02")).toBe(true);
  });

  test("rejects non contiguous order", () => {
    expect(
      () =>
        new ChapterRegistry({
          storylineId: "fire-dawn",
          chapters: [
            { id: "ch01", order: 1, prevId: null, nextId: "ch02", enabled: true, title: "第一章" },
            { id: "ch02", order: 3, prevId: "ch01", nextId: null, enabled: true, title: "第二章" }
          ]
        })
    ).toThrow(ChapterTimelineError);
  });
});
