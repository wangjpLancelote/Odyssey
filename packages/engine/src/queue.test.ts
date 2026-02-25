import { describe, expect, test } from "bun:test";
import { isTaskDuplicate, markTaskProcessed } from "./queue";

describe("queue idempotency", () => {
  test("marks dedupe key after process", () => {
    const processed = new Set<string>();

    const task = {
      id: "task-1",
      type: "AI_SIDEQUEST_GENERATE",
      payload: {},
      dedupeKey: "dedupe-1",
      attempts: 0,
      status: "PENDING",
      createdAt: new Date().toISOString()
    } as const;

    expect(isTaskDuplicate(task, processed)).toBe(false);
    markTaskProcessed(task, processed);
    expect(isTaskDuplicate(task, processed)).toBe(true);
  });
});
