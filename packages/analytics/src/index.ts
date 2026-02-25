import type { TelemetryEvent } from "@odyssey/shared";

export const telemetryEventNames = {
  dialogueAdvanced: "dialogue_advanced",
  choiceCommitted: "choice_committed",
  checkpointCreated: "footprint_checkpoint_created",
  footprintRestored: "footprint_restored",
  sideQuestTriggered: "sidequest_triggered",
  cutscenePlayed: "cutscene_played",
  cutsceneSkipped: "cutscene_skipped",
  audioMuted: "audio_muted",
  audioUnmuted: "audio_unmuted"
} as const;

export class InMemoryTelemetrySink {
  private readonly events: TelemetryEvent[] = [];

  push(event: TelemetryEvent): void {
    this.events.push(event);
  }

  listBySession(sessionId: string): TelemetryEvent[] {
    return this.events.filter((event) => event.sessionId === sessionId);
  }
}
