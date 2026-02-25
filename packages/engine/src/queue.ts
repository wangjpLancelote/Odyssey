import type { QueueTask } from "@odyssey/shared";

export function isTaskDuplicate(task: QueueTask, processedDedupeKeys: Set<string>): boolean {
  return processedDedupeKeys.has(task.dedupeKey);
}

export function markTaskProcessed(task: QueueTask, processedDedupeKeys: Set<string>): void {
  processedDedupeKeys.add(task.dedupeKey);
}
