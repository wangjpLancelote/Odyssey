import { z } from "zod";

export const realtimeEventSchema = z.object({
  type: z.enum([
    "cutscene.state_changed",
    "audio.cue_triggered",
    "dialogue.updated",
    "plot.branch_created",
    "footprint.checkpoint_created",
    "sidequest.state_changed",
    "world.violation_detected"
  ]),
  sessionId: z.string(),
  payload: z.record(z.any()),
  occurredAt: z.string()
});

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

export interface RealtimePublisher {
  publish(event: RealtimeEvent): Promise<void>;
}

export class NoopRealtimePublisher implements RealtimePublisher {
  async publish(_event: RealtimeEvent): Promise<void> {
    // MVP: replace with SSE/WebSocket broker later.
  }
}
