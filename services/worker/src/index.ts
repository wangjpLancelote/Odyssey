import { MockLlmAdapter, generateSideQuest } from "@odyssey/ai";
import { markTaskProcessed } from "@odyssey/engine";
import type { QueueTask } from "@odyssey/shared";

const queue: QueueTask[] = [];
const processed = new Set<string>();

async function processTask(task: QueueTask): Promise<void> {
  switch (task.type) {
    case "AI_SIDEQUEST_GENERATE": {
      await generateSideQuest(
        new MockLlmAdapter(),
        task.payload.input,
        task.payload.currentState,
        task.payload.releasedSpirits
      );
      markTaskProcessed(task, processed);
      break;
    }
    case "ASSET_PREWARM":
    case "TELEMETRY_AGGREGATE": {
      markTaskProcessed(task, processed);
      break;
    }
    default: {
      break;
    }
  }
}

async function tick(): Promise<void> {
  const task = queue.shift();
  if (!task) return;

  if (processed.has(task.dedupeKey)) return;

  await processTask(task);
}

setInterval(() => {
  void tick();
}, 1000);

console.log("[worker] queue processor booted");
