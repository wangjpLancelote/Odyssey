import { MockLlmAdapter, generateSideQuest } from "@odyssey/ai";
import { telemetryEventNames } from "@odyssey/analytics";
import {
  buildPlotEdge,
  cassellIntroChapter,
  cassellIntroNodes,
  defaultBloodlineState,
  defaultRank,
  defaultWordSpirits
} from "@odyssey/domain";
import {
  addCheckpoint,
  appendPlotEdge,
  appendVisitedNode,
  createFootprintMap,
  createPlotTree,
  restoreCheckpoint
} from "@odyssey/engine";
import {
  gameSessionSchema,
  type DialogueChoice,
  type DialogueNode,
  type FootprintMap,
  type GameSession,
  type PlotEdge,
  type SideQuestState,
  type TelemetryEvent,
  type TuningConfig
} from "@odyssey/shared";
import { detectDayNightBySystemTime } from "@/lib/day-night";
import { generateDisplayNameSuggestions } from "@/lib/name-generator";
import { normalizeDisplayName, sanitizeDisplayName, validateDisplayName } from "@/lib/name-utils";
import { cutsceneDslManifest } from "@/lib/cutscene-specs";

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

export class NameConflictError extends Error {
  readonly suggestions: string[];

  constructor(suggestions: string[]) {
    super("name_conflict");
    this.suggestions = suggestions;
  }
}

type SessionRuntime = {
  session: GameSession;
  sessionToken: string;
  normalizedDisplayName: string;
  plotEdges: PlotEdge[];
  footprint: FootprintMap;
  sideQuestState: SideQuestState;
  currentBranchTag?: string;
  expiresAtMs: number;
};

class InMemoryGameStore {
  private readonly sessions = new Map<string, SessionRuntime>();
  private readonly activeNameRegistry = new Map<string, string>();
  private readonly events: TelemetryEvent[] = [];
  private sessionLock: Promise<void> = Promise.resolve();

  private readonly tuning: TuningConfig = {
    sideQuestTriggerRate: 0.5,
    canonStrictness: 0.9,
    animationPace: 1,
    voiceLineMaxLength: 120
  };

  async startSession(displayName: string): Promise<{
    session: GameSession;
    sessionToken: string;
    node: DialogueNode;
  }> {
    return this.withSessionLock(async () => {
      this.cleanupExpiredSessions();

      const validationError = validateDisplayName(displayName);
      if (validationError) {
        throw new Error("invalid_display_name");
      }

      const sanitizedDisplayName = sanitizeDisplayName(displayName);
      const normalizedDisplayName = normalizeDisplayName(sanitizedDisplayName);
      const occupiedSessionId = this.activeNameRegistry.get(normalizedDisplayName);

      if (occupiedSessionId && this.sessions.has(occupiedSessionId)) {
        throw new NameConflictError(this.buildNameSuggestions(5));
      }

      const now = new Date().toISOString();
      const sessionId = `session-${crypto.randomUUID()}`;
      const playerId = `anon-${crypto.randomUUID()}`;
      const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const startNode = cassellIntroNodes[cassellIntroChapter.startNodeId];

      let footprint = createFootprintMap(sessionId, playerId);
      footprint = appendVisitedNode(footprint, startNode.id);
      if (startNode.checkpoint) {
        footprint = addCheckpoint(footprint, startNode.id, "0", { reason: "chapter_start" });
      }

      const session = gameSessionSchema.parse({
        id: sessionId,
        playerId,
        displayName: sanitizedDisplayName,
        chapterId: cassellIntroChapter.id,
        currentNodeId: startNode.id,
        status: "ACTIVE",
        dayNight: detectDayNightBySystemTime(),
        createdAt: now,
        updatedAt: now
      });

      this.sessions.set(sessionId, {
        session,
        sessionToken,
        normalizedDisplayName,
        plotEdges: createPlotTree(sessionId).edges,
        footprint,
        sideQuestState: "IDLE",
        expiresAtMs: Date.now() + SESSION_TTL_MS
      });

      this.activeNameRegistry.set(normalizedDisplayName, sessionId);

      this.track({
        name: telemetryEventNames.dialogueAdvanced,
        playerId,
        sessionId,
        attributes: { nodeId: startNode.id }
      });

      return { session, sessionToken, node: startNode };
    });
  }

  getNode(sessionId: string, sessionToken: string): { session: GameSession; node: DialogueNode } | null {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) return null;

    const node = cassellIntroNodes[runtime.session.currentNodeId];
    return { session: runtime.session, node };
  }

  commitChoice(
    sessionId: string,
    sessionToken: string,
    choiceId: string
  ): { session: GameSession; node: DialogueNode } {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    const currentNode = cassellIntroNodes[runtime.session.currentNodeId];
    const choice = currentNode.choices.find((item) => item.id === choiceId);

    if (!choice) {
      throw new Error("choice_not_found");
    }

    const nextNode = cassellIntroNodes[choice.nextNodeId];
    if (!nextNode) {
      throw new Error("next_node_not_found");
    }

    runtime.currentBranchTag = choice.branchTag;

    runtime.plotEdges = appendPlotEdge(
      { sessionId, edges: runtime.plotEdges },
      buildPlotEdge(currentNode.id, nextNode.id, choice.id)
    ).edges;

    runtime.footprint = appendVisitedNode(runtime.footprint, nextNode.id);

    if (nextNode.checkpoint) {
      runtime.footprint = addCheckpoint(
        runtime.footprint,
        nextNode.id,
        String(runtime.plotEdges.length),
        { viaChoice: choice.id }
      );

      this.track({
        name: telemetryEventNames.checkpointCreated,
        playerId: runtime.session.playerId,
        sessionId,
        attributes: { nodeId: nextNode.id }
      });
    }

    runtime.session = {
      ...runtime.session,
      currentNodeId: nextNode.id,
      dayNight: detectDayNightBySystemTime(),
      updatedAt: new Date().toISOString()
    };

    this.track({
      name: telemetryEventNames.choiceCommitted,
      playerId: runtime.session.playerId,
      sessionId,
      attributes: {
        choiceId,
        fromNodeId: currentNode.id,
        toNodeId: nextNode.id
      }
    });

    return { session: runtime.session, node: nextNode };
  }

  listChoices(sessionId: string, sessionToken: string): DialogueChoice[] {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    return cassellIntroNodes[runtime.session.currentNodeId].choices;
  }

  footprintMap(sessionId: string, sessionToken: string): FootprintMap {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    return runtime.footprint;
  }

  restore(
    sessionId: string,
    sessionToken: string,
    checkpointId: string
  ): { session: GameSession; node: DialogueNode } {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    const checkpoint = restoreCheckpoint(runtime.footprint, checkpointId);
    if (!checkpoint) {
      throw new Error("checkpoint_not_found");
    }

    const checkpointCursor = Number(checkpoint.plotCursor);
    runtime.plotEdges = runtime.plotEdges.slice(0, checkpointCursor);

    runtime.session = {
      ...runtime.session,
      currentNodeId: checkpoint.nodeId,
      dayNight: detectDayNightBySystemTime(),
      updatedAt: new Date().toISOString()
    };

    this.track({
      name: telemetryEventNames.footprintRestored,
      playerId: runtime.session.playerId,
      sessionId,
      attributes: { checkpointId }
    });

    return {
      session: runtime.session,
      node: cassellIntroNodes[checkpoint.nodeId]
    };
  }

  async triggerSideQuest(sessionId: string, sessionToken: string): Promise<{
    state: SideQuestState;
    blocked: boolean;
    candidates: string[];
  }> {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    const result = await generateSideQuest(
      new MockLlmAdapter(),
      {
        sessionId,
        playerId: runtime.session.playerId,
        chapterId: runtime.session.chapterId,
        nodeId: runtime.session.currentNodeId,
        rank: defaultRank,
        bloodline: defaultBloodlineState,
        prohibitedCanonRules: []
      },
      runtime.sideQuestState,
      defaultWordSpirits
    );

    runtime.sideQuestState = result.nextState;

    this.track({
      name: telemetryEventNames.sideQuestTriggered,
      playerId: runtime.session.playerId,
      sessionId,
      attributes: { blocked: result.blocked, riskFlags: result.riskFlags }
    });

    return {
      state: result.nextState,
      blocked: result.blocked,
      candidates: result.candidateBranches.map((branch) => branch.title)
    };
  }

  getDayNight(sessionId: string, sessionToken: string): "DAY" | "NIGHT" {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    runtime.session.dayNight = detectDayNightBySystemTime();
    return runtime.session.dayNight;
  }

  getCutsceneContext(
    sessionId: string,
    sessionToken: string,
    cutsceneId: keyof typeof cutsceneDslManifest
  ): { cutsceneId: keyof typeof cutsceneDslManifest; sceneId: string; dayNight: "DAY" | "NIGHT"; branchTag?: string } {
    const runtime = this.ensureAuthorizedSession(sessionId, sessionToken);
    if (!runtime) {
      throw new Error("session_not_found");
    }

    const manifest = cutsceneDslManifest[cutsceneId];
    return {
      cutsceneId,
      sceneId: manifest.sceneId,
      dayNight: runtime.session.dayNight,
      branchTag: runtime.currentBranchTag
    };
  }

  getTuning(): TuningConfig {
    return this.tuning;
  }

  getEvents(sessionId: string): TelemetryEvent[] {
    return this.events.filter((evt) => evt.sessionId === sessionId);
  }

  private cleanupExpiredSessions(): void {
    const nowMs = Date.now();
    for (const [sessionId, runtime] of this.sessions.entries()) {
      if (runtime.expiresAtMs > nowMs) continue;

      this.sessions.delete(sessionId);
      const current = this.activeNameRegistry.get(runtime.normalizedDisplayName);
      if (current === sessionId) {
        this.activeNameRegistry.delete(runtime.normalizedDisplayName);
      }
    }
  }

  private ensureAuthorizedSession(sessionId: string, sessionToken: string): SessionRuntime | null {
    this.cleanupExpiredSessions();

    const runtime = this.sessions.get(sessionId);
    if (!runtime) {
      return null;
    }

    if (runtime.sessionToken !== sessionToken) {
      throw new Error("unauthorized_session");
    }

    runtime.expiresAtMs = Date.now() + SESSION_TTL_MS;
    return runtime;
  }

  private buildNameSuggestions(count: number): string[] {
    const suggestions = generateDisplayNameSuggestions(Math.max(3, count * 2));
    const available = suggestions.filter((name) => !this.activeNameRegistry.has(normalizeDisplayName(name)));
    return available.slice(0, count);
  }

  private track(event: Omit<TelemetryEvent, "id" | "occurredAt">): void {
    this.events.push({
      id: `evt-${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
      ...event
    });
  }

  private async withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.sessionLock;
    let release!: () => void;
    this.sessionLock = new Promise((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const globalForStore = globalThis as unknown as {
  __odyssey_store?: InMemoryGameStore;
};

export const gameStore = globalForStore.__odyssey_store ?? new InMemoryGameStore();

if (!globalForStore.__odyssey_store) {
  globalForStore.__odyssey_store = gameStore;
}
