import { MockLlmAdapter, generateSideQuest } from "@odyssey/ai";
import { telemetryEventNames } from "@odyssey/analytics";
import { buildPlotEdge, defaultBloodlineState, defaultRank, defaultWordSpirits } from "@odyssey/domain";
import {
  gameSessionSchema,
  type ChapterTimeline,
  type DialogueChoice,
  type DialogueNode,
  type FootprintMap,
  type GameSession,
  type SideQuestState,
  type TelemetryEvent,
  type TuningConfig
} from "@odyssey/shared";
import { detectDayNightBySystemTime } from "@/lib/day-night";
import { generateDisplayNameSuggestions } from "@/lib/name-generator";
import { normalizeDisplayName, sanitizeDisplayName, validateDisplayName } from "@/lib/name-utils";
import { chapterResourceManager } from "@/lib/server/chapter-resource-manager";
import { getSupabaseAdminClient } from "@/lib/server/supabase";

const SESSION_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_STORYLINE_ID = "fire-dawn";
const DEFAULT_CHAPTER_ID = "ch01";

export class NameConflictError extends Error {
  readonly suggestions: string[];

  constructor(suggestions: string[]) {
    super("name_conflict");
    this.suggestions = suggestions;
  }
}

type StartSessionRow = {
  session_id: string | null;
  session_token: string | null;
  player_id: string | null;
  display_name: string | null;
  storyline_id: string | null;
  chapter_id: string | null;
  current_node_id: string | null;
  day_night: "DAY" | "NIGHT" | null;
  status: "ACTIVE" | "PAUSED" | "FINISHED" | null;
  created_at: string | null;
  updated_at: string | null;
  name_conflict: boolean;
};

type LegacyStartSessionRow = Omit<StartSessionRow, "storyline_id">;

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type AuthorizedSessionRow = {
  session_id: string;
  session_token: string;
  player_id: string;
  display_name: string;
  storyline_id: string;
  chapter_id: string;
  current_node_id: string;
  current_branch_tag: string | null;
  day_night: "DAY" | "NIGHT";
  status: "ACTIVE" | "PAUSED" | "FINISHED";
  created_at: string;
  updated_at: string;
};

type FootprintCheckpointRow = {
  checkpoint_id: string;
  storyline_id: string;
  chapter_id: string;
  node_id: string;
  plot_cursor: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

class SupabaseGameStore {
  private readonly events: TelemetryEvent[] = [];

  private readonly tuning: TuningConfig = {
    sideQuestTriggerRate: 0.5,
    canonStrictness: 0.9,
    animationPace: 1,
    voiceLineMaxLength: 120
  };

  async startSession(
    displayName: string,
    storylineId = DEFAULT_STORYLINE_ID,
    chapterId = DEFAULT_CHAPTER_ID
  ): Promise<{
    session: GameSession;
    sessionToken: string;
    node: DialogueNode;
  }> {
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      throw new Error("invalid_display_name");
    }

    await chapterResourceManager.assertStartableChapter(storylineId, chapterId);
    const chapterBundle = await chapterResourceManager.loadChapterBundle(storylineId, chapterId);

    const sanitizedDisplayName = sanitizeDisplayName(displayName);
    const dayNight = detectDayNightBySystemTime();
    const row = await this.startSessionRpc({
      displayName: sanitizedDisplayName,
      storylineId,
      chapterId,
      startNodeId: chapterBundle.meta.startNodeId,
      dayNight
    });

    if (row.name_conflict || !row.session_id || !row.session_token) {
      throw new NameConflictError(await this.buildNameSuggestions(5));
    }

    const session = gameSessionSchema.parse({
      id: row.session_id,
      playerId: row.player_id,
      displayName: row.display_name,
      storylineId: row.storyline_id,
      chapterId: row.chapter_id,
      currentNodeId: row.current_node_id,
      status: row.status,
      dayNight: row.day_night,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });

    const node = chapterBundle.nodes[session.currentNodeId];
    if (!node) {
      throw new Error("node_not_found");
    }

    this.track({
      name: telemetryEventNames.dialogueAdvanced,
      playerId: session.playerId,
      sessionId: session.id,
      attributes: { nodeId: session.currentNodeId }
    });

    return {
      session,
      sessionToken: row.session_token,
      node
    };
  }

  async getNode(
    sessionId: string,
    sessionToken: string
  ): Promise<{ session: GameSession; node: DialogueNode } | null> {
    try {
      const row = await this.ensureAuthorizedSession(sessionId, sessionToken);
      const session = this.toGameSession(row);
      const node = await this.resolveSessionNode(row);
      return { session, node };
    } catch (error) {
      if (error instanceof Error && error.message === "session_not_found") {
        return null;
      }
      throw error;
    }
  }

  async recallSession(displayName: string): Promise<{
    session: GameSession;
    sessionToken: string;
    node: DialogueNode;
  }> {
    const normalized = normalizeDisplayName(displayName);

    const { data: playerRow, error: playerError } = await getSupabaseAdminClient()
      .from("ody_players")
      .select("id,display_name")
      .eq("normalized_display_name", normalized)
      .limit(1)
      .maybeSingle();

    if (playerError) {
      throw new Error("supabase_query_failed");
    }

    if (!playerRow) {
      throw new Error("name_not_found");
    }

    const { data, error } = await getSupabaseAdminClient()
      .from("ody_name_locks")
      .select(
        `
        session_id,
        ody_sessions!inner (
          id, session_token, player_id, storyline_id, chapter_id,
          current_node_id, current_branch_tag, day_night, status,
          created_at, updated_at, expires_at
        )
      `
      )
      .eq("normalized_display_name", normalized)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error("supabase_query_failed");
    }

    if (!data) {
      throw new Error("no_active_session");
    }

    const sessionRow = Array.isArray(data.ody_sessions)
      ? data.ody_sessions[0]
      : (data.ody_sessions as Record<string, unknown>);

    if (
      !sessionRow ||
      sessionRow.status !== "ACTIVE" ||
      !sessionRow.expires_at ||
      new Date(sessionRow.expires_at as string) <= new Date()
    ) {
      throw new Error("no_active_session");
    }

    const resolvedDisplayName = playerRow.display_name ?? displayName;

    const newExpiry = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    await Promise.all([
      getSupabaseAdminClient()
        .from("ody_sessions")
        .update({ expires_at: newExpiry, updated_at: new Date().toISOString() })
        .eq("id", sessionRow.id as string),
      getSupabaseAdminClient()
        .from("ody_name_locks")
        .update({ expires_at: newExpiry })
        .eq("session_id", sessionRow.id as string)
    ]);

    const session = gameSessionSchema.parse({
      id: sessionRow.id,
      playerId: sessionRow.player_id,
      displayName: resolvedDisplayName,
      storylineId: sessionRow.storyline_id,
      chapterId: sessionRow.chapter_id,
      currentNodeId: sessionRow.current_node_id,
      status: sessionRow.status,
      dayNight: sessionRow.day_night,
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at
    });

    const bundle = await chapterResourceManager.loadChapterBundle(
      sessionRow.storyline_id as string,
      sessionRow.chapter_id as string
    );
    const node = bundle.nodes[sessionRow.current_node_id as string];

    if (!node) {
      throw new Error("node_not_found");
    }

    return {
      session,
      sessionToken: sessionRow.session_token as string,
      node
    };
  }

  async commitChoice(
    sessionId: string,
    sessionToken: string,
    choiceId: string
  ): Promise<{ session: GameSession; node: DialogueNode }> {
    const authorized = await this.ensureAuthorizedSession(sessionId, sessionToken);
    const currentBundle = await chapterResourceManager.loadChapterBundle(
      authorized.storyline_id,
      authorized.chapter_id
    );
    const currentNode = currentBundle.nodes[authorized.current_node_id];

    if (!currentNode) {
      throw new Error("node_not_found");
    }

    const choice = currentNode.choices.find((item) => item.id === choiceId);
    if (!choice) {
      throw new Error("choice_not_found");
    }

    const targetChapterId = choice.nextChapterId ?? authorized.chapter_id;

    if (targetChapterId !== authorized.chapter_id) {
      await chapterResourceManager.assertCanEnterNext(
        authorized.storyline_id,
        authorized.chapter_id,
        targetChapterId
      );
    }

    const targetBundle = await chapterResourceManager.loadChapterBundle(authorized.storyline_id, targetChapterId);
    const nextNode = targetBundle.nodes[choice.nextNodeId];

    if (!nextNode) {
      throw new Error("next_node_not_found");
    }

    const edge = buildPlotEdge(currentNode.id, nextNode.id, choice.id);

    const { error: edgeError } = await getSupabaseAdminClient().from("ody_plot_edges").insert({
      session_id: sessionId,
      from_node_id: edge.fromNodeId,
      to_node_id: edge.toNodeId,
      choice_id: edge.choiceId,
      created_at: edge.createdAt
    });

    if (edgeError) {
      throw new Error("supabase_query_failed");
    }

    const { error: visitedError } = await getSupabaseAdminClient().from("ody_visited_nodes").upsert(
      {
        session_id: sessionId,
        node_id: nextNode.id
      },
      { onConflict: "session_id,node_id" }
    );

    if (visitedError) {
      throw new Error("supabase_query_failed");
    }

    const { count: plotEdgeCount, error: plotCountError } = await getSupabaseAdminClient()
      .from("ody_plot_edges")
      .select("id", { head: true, count: "exact" })
      .eq("session_id", sessionId);

    if (plotCountError) {
      throw new Error("supabase_query_failed");
    }

    if (nextNode.checkpoint) {
      const { count: checkpointCount, error: checkpointCountError } = await getSupabaseAdminClient()
        .from("ody_footprint_checkpoints")
        .select("checkpoint_id", { head: true, count: "exact" })
        .eq("session_id", sessionId);

      if (checkpointCountError) {
        throw new Error("supabase_query_failed");
      }

      const checkpointId = `cp-${sessionId}-${(checkpointCount ?? 0) + 1}`;

      const { error: checkpointInsertError } = await getSupabaseAdminClient()
        .from("ody_footprint_checkpoints")
        .insert({
          checkpoint_id: checkpointId,
          session_id: sessionId,
          storyline_id: authorized.storyline_id,
          chapter_id: targetChapterId,
          node_id: nextNode.id,
          plot_cursor: plotEdgeCount ?? 0,
          metadata: {
            viaChoice: choice.id
          }
        });

      if (checkpointInsertError) {
        throw new Error("supabase_query_failed");
      }

      this.track({
        name: telemetryEventNames.checkpointCreated,
        playerId: authorized.player_id,
        sessionId,
        attributes: { nodeId: nextNode.id, chapterId: targetChapterId }
      });
    }

    const dayNight = detectDayNightBySystemTime();
    const { error: updateError } = await getSupabaseAdminClient()
      .from("ody_sessions")
      .update({
        chapter_id: targetChapterId,
        current_node_id: nextNode.id,
        current_branch_tag: choice.branchTag ?? null,
        day_night: dayNight,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("session_token", sessionToken);

    if (updateError) {
      throw new Error("supabase_query_failed");
    }

    const refreshed = await this.ensureAuthorizedSession(sessionId, sessionToken);

    this.track({
      name: telemetryEventNames.choiceCommitted,
      playerId: refreshed.player_id,
      sessionId,
      attributes: {
        choiceId,
        fromNodeId: currentNode.id,
        toNodeId: nextNode.id,
        toChapterId: targetChapterId
      }
    });

    return {
      session: this.toGameSession(refreshed),
      node: nextNode
    };
  }

  async enterChapter(
    sessionId: string,
    sessionToken: string,
    toChapterId: string
  ): Promise<{ session: GameSession; node: DialogueNode; resourceReloadedChapter: string | null }> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);

    if (toChapterId === runtime.chapter_id) {
      throw new Error("chapter_transition_not_allowed");
    }

    await chapterResourceManager.assertCanEnterNext(runtime.storyline_id, runtime.chapter_id, toChapterId);
    const targetBundle = await chapterResourceManager.loadChapterBundle(runtime.storyline_id, toChapterId);
    const startNode = targetBundle.nodes[targetBundle.meta.startNodeId];

    if (!startNode) {
      throw new Error("chapter_start_node_not_found");
    }

    const dayNight = detectDayNightBySystemTime();
    const { error: updateError } = await getSupabaseAdminClient()
      .from("ody_sessions")
      .update({
        chapter_id: toChapterId,
        current_node_id: startNode.id,
        current_branch_tag: null,
        day_night: dayNight,
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("session_token", sessionToken);

    if (updateError) {
      throw new Error("supabase_query_failed");
    }

    const { error: visitedError } = await getSupabaseAdminClient().from("ody_visited_nodes").upsert(
      {
        session_id: sessionId,
        node_id: startNode.id
      },
      { onConflict: "session_id,node_id" }
    );

    if (visitedError) {
      throw new Error("supabase_query_failed");
    }

    const { count: checkpointCount, error: checkpointCountError } = await getSupabaseAdminClient()
      .from("ody_footprint_checkpoints")
      .select("checkpoint_id", { head: true, count: "exact" })
      .eq("session_id", sessionId);

    if (checkpointCountError) {
      throw new Error("supabase_query_failed");
    }

    const checkpointId = `cp-${sessionId}-${(checkpointCount ?? 0) + 1}`;

    const { count: plotEdgeCount, error: plotEdgeCountError } = await getSupabaseAdminClient()
      .from("ody_plot_edges")
      .select("id", { head: true, count: "exact" })
      .eq("session_id", sessionId);

    if (plotEdgeCountError) {
      throw new Error("supabase_query_failed");
    }

    const { error: checkpointError } = await getSupabaseAdminClient().from("ody_footprint_checkpoints").insert({
      checkpoint_id: checkpointId,
      session_id: sessionId,
      storyline_id: runtime.storyline_id,
      chapter_id: toChapterId,
      node_id: startNode.id,
      plot_cursor: plotEdgeCount ?? 0,
      metadata: {
        reason: "chapter_enter"
      }
    });

    if (checkpointError) {
      throw new Error("supabase_query_failed");
    }

    const refreshed = await this.ensureAuthorizedSession(sessionId, sessionToken);

    return {
      session: this.toGameSession(refreshed),
      node: startNode,
      resourceReloadedChapter: toChapterId
    };
  }

  async listChoices(sessionId: string, sessionToken: string): Promise<DialogueChoice[]> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);
    const bundle = await chapterResourceManager.loadChapterBundle(runtime.storyline_id, runtime.chapter_id);
    const node = bundle.nodes[runtime.current_node_id];

    if (!node) {
      throw new Error("node_not_found");
    }

    return node.choices;
  }

  async footprintMap(sessionId: string, sessionToken: string): Promise<FootprintMap> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);

    const { data: checkpoints, error: checkpointError } = await getSupabaseAdminClient()
      .from("ody_footprint_checkpoints")
      .select("checkpoint_id,storyline_id,chapter_id,node_id,plot_cursor,metadata,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (checkpointError) {
      throw new Error("supabase_query_failed");
    }

    const { data: visitedNodeRows, error: visitedError } = await getSupabaseAdminClient()
      .from("ody_visited_nodes")
      .select("node_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (visitedError) {
      throw new Error("supabase_query_failed");
    }

    return {
      sessionId,
      playerId: runtime.player_id,
      checkpoints: (checkpoints as FootprintCheckpointRow[]).map((row) => ({
        checkpointId: row.checkpoint_id,
        sessionId,
        storylineId: row.storyline_id,
        chapterId: row.chapter_id,
        nodeId: row.node_id,
        plotCursor: String(row.plot_cursor),
        metadata: row.metadata ?? {},
        createdAt: row.created_at
      })),
      visitedNodeIds: (visitedNodeRows ?? []).map((row) => row.node_id)
    };
  }

  async restore(
    sessionId: string,
    sessionToken: string,
    checkpointId: string
  ): Promise<{ session: GameSession; node: DialogueNode; resourceReloadedChapter: string | null }> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);

    const { data: checkpoint, error: checkpointError } = await getSupabaseAdminClient()
      .from("ody_footprint_checkpoints")
      .select("checkpoint_id,storyline_id,chapter_id,node_id,plot_cursor")
      .eq("session_id", sessionId)
      .eq("checkpoint_id", checkpointId)
      .maybeSingle();

    if (checkpointError) {
      throw new Error("supabase_query_failed");
    }

    if (!checkpoint) {
      throw new Error("checkpoint_not_found");
    }

    const { data: allEdges, error: edgeError } = await getSupabaseAdminClient()
      .from("ody_plot_edges")
      .select("id")
      .eq("session_id", sessionId)
      .order("id", { ascending: true });

    if (edgeError) {
      throw new Error("supabase_query_failed");
    }

    const idsToDelete = (allEdges ?? []).slice(checkpoint.plot_cursor).map((edge) => edge.id);
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await getSupabaseAdminClient()
        .from("ody_plot_edges")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        throw new Error("supabase_query_failed");
      }
    }

    const { error: updateError } = await getSupabaseAdminClient()
      .from("ody_sessions")
      .update({
        storyline_id: checkpoint.storyline_id,
        chapter_id: checkpoint.chapter_id,
        current_node_id: checkpoint.node_id,
        day_night: detectDayNightBySystemTime(),
        updated_at: new Date().toISOString()
      })
      .eq("id", sessionId)
      .eq("session_token", sessionToken);

    if (updateError) {
      throw new Error("supabase_query_failed");
    }

    const refreshed = await this.ensureAuthorizedSession(sessionId, sessionToken);
    const bundle = await chapterResourceManager.loadChapterBundle(checkpoint.storyline_id, checkpoint.chapter_id);
    const node = bundle.nodes[checkpoint.node_id];

    if (!node) {
      throw new Error("node_not_found");
    }

    const resourceReloadedChapter =
      runtime.storyline_id !== checkpoint.storyline_id || runtime.chapter_id !== checkpoint.chapter_id
        ? checkpoint.chapter_id
        : null;

    this.track({
      name: telemetryEventNames.footprintRestored,
      playerId: runtime.player_id,
      sessionId,
      attributes: {
        checkpointId,
        fromChapterId: runtime.chapter_id,
        toChapterId: checkpoint.chapter_id
      }
    });

    return {
      session: this.toGameSession(refreshed),
      node,
      resourceReloadedChapter
    };
  }

  async triggerSideQuest(sessionId: string, sessionToken: string): Promise<{
    state: SideQuestState;
    blocked: boolean;
    candidates: string[];
  }> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);

    const { data: sidequestStateRow, error: sidequestStateError } = await getSupabaseAdminClient()
      .from("ody_sidequest_states")
      .select("state")
      .eq("session_id", sessionId)
      .maybeSingle();

    if (sidequestStateError) {
      throw new Error("supabase_query_failed");
    }

    const result = await generateSideQuest(
      new MockLlmAdapter(),
      {
        sessionId,
        playerId: runtime.player_id,
        chapterId: runtime.chapter_id,
        nodeId: runtime.current_node_id,
        rank: defaultRank,
        bloodline: defaultBloodlineState,
        prohibitedCanonRules: []
      },
      (sidequestStateRow?.state as SideQuestState | undefined) ?? "IDLE",
      defaultWordSpirits
    );

    const { error: upsertError } = await getSupabaseAdminClient().from("ody_sidequest_states").upsert(
      {
        session_id: sessionId,
        state: result.nextState,
        updated_at: new Date().toISOString()
      },
      { onConflict: "session_id" }
    );

    if (upsertError) {
      throw new Error("supabase_query_failed");
    }

    this.track({
      name: telemetryEventNames.sideQuestTriggered,
      playerId: runtime.player_id,
      sessionId,
      attributes: { blocked: result.blocked, riskFlags: result.riskFlags }
    });

    return {
      state: result.nextState,
      blocked: result.blocked,
      candidates: result.candidateBranches.map((branch) => branch.title)
    };
  }

  async getDayNight(sessionId: string, sessionToken: string): Promise<"DAY" | "NIGHT"> {
    await this.ensureAuthorizedSession(sessionId, sessionToken);
    const dayNight = detectDayNightBySystemTime();

    const { error } = await getSupabaseAdminClient()
      .from("ody_sessions")
      .update({ day_night: dayNight, updated_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("session_token", sessionToken);

    if (error) {
      throw new Error("supabase_query_failed");
    }

    return dayNight;
  }

  async getCutsceneContext(
    sessionId: string,
    sessionToken: string,
    cutsceneId?: string
  ): Promise<{
    storylineId: string;
    chapterId: string;
    cutsceneId: string;
    sceneId: string;
    dayNight: "DAY" | "NIGHT";
    branchTag?: string;
  }> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);
    const cutscene = await chapterResourceManager.resolveCutsceneMeta(
      runtime.storyline_id,
      runtime.chapter_id,
      cutsceneId
    );

    return {
      storylineId: runtime.storyline_id,
      chapterId: runtime.chapter_id,
      cutsceneId: cutscene.cutsceneId,
      sceneId: cutscene.sceneId,
      dayNight: runtime.day_night,
      branchTag: runtime.current_branch_tag ?? undefined
    };
  }

  async getComicContext(
    sessionId: string,
    sessionToken: string
  ): Promise<{
    session: GameSession;
    node: DialogueNode;
    dayNight: "DAY" | "NIGHT";
    branchTag?: string;
  }> {
    const runtime = await this.ensureAuthorizedSession(sessionId, sessionToken);
    const node = await this.resolveSessionNode(runtime);
    return {
      session: this.toGameSession(runtime),
      node,
      dayNight: runtime.day_night,
      branchTag: runtime.current_branch_tag ?? undefined
    };
  }

  async getChapterTimeline(storylineId: string): Promise<ChapterTimeline> {
    return chapterResourceManager.getTimeline(storylineId);
  }

  async suggestDisplayNames(count: number): Promise<string[]> {
    return this.buildNameSuggestions(count);
  }

  getTuning(): TuningConfig {
    return this.tuning;
  }

  getEvents(sessionId: string): TelemetryEvent[] {
    return this.events.filter((evt) => evt.sessionId === sessionId);
  }

  private async ensureAuthorizedSession(
    sessionId: string,
    sessionToken: string
  ): Promise<AuthorizedSessionRow> {
    const { data, error } = await getSupabaseAdminClient().rpc("ody_authorize_session", {
      p_session_id: sessionId,
      p_session_token: sessionToken,
      p_session_ttl_seconds: SESSION_TTL_SECONDS
    });

    if (error) {
      throw new Error("supabase_query_failed");
    }

    const authorized = (data as AuthorizedSessionRow[] | null)?.[0] ?? null;
    if (authorized) {
      return authorized;
    }

    const { data: existing, error: existingError } = await getSupabaseAdminClient()
      .from("ody_sessions")
      .select("id")
      .eq("id", sessionId)
      .maybeSingle();

    if (existingError) {
      throw new Error("supabase_query_failed");
    }

    if (existing) {
      throw new Error("unauthorized_session");
    }

    throw new Error("session_not_found");
  }

  private async buildNameSuggestions(count: number): Promise<string[]> {
    const target = Math.max(3, count);
    const pool = generateDisplayNameSuggestions(target * 3);
    const normalizedCandidates = [...new Set(pool.map((name) => normalizeDisplayName(name)))];

    const { data: activeLocks, error } = await getSupabaseAdminClient()
      .from("ody_name_locks")
      .select("normalized_display_name")
      .in("normalized_display_name", normalizedCandidates);

    if (error) {
      return pool.slice(0, target);
    }

    const locked = new Set((activeLocks ?? []).map((item) => item.normalized_display_name));
    const available = pool.filter((name) => !locked.has(normalizeDisplayName(name)));

    if (available.length >= target) {
      return available.slice(0, target);
    }

    return [...available, ...generateDisplayNameSuggestions(target)].slice(0, target);
  }

  private toGameSession(row: AuthorizedSessionRow): GameSession {
    return gameSessionSchema.parse({
      id: row.session_id,
      playerId: row.player_id,
      displayName: row.display_name,
      storylineId: row.storyline_id,
      chapterId: row.chapter_id,
      currentNodeId: row.current_node_id,
      status: row.status,
      dayNight: row.day_night,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  private async resolveSessionNode(row: AuthorizedSessionRow): Promise<DialogueNode> {
    const bundle = await chapterResourceManager.loadChapterBundle(row.storyline_id, row.chapter_id);
    const node = bundle.nodes[row.current_node_id];

    if (!node) {
      throw new Error("node_not_found");
    }

    return node;
  }

  private track(event: Omit<TelemetryEvent, "id" | "occurredAt">): void {
    this.events.push({
      id: `evt-${crypto.randomUUID()}`,
      occurredAt: new Date().toISOString(),
      ...event
    });
  }

  private async startSessionRpc(input: {
    displayName: string;
    storylineId: string;
    chapterId: string;
    startNodeId: string;
    dayNight: "DAY" | "NIGHT";
  }): Promise<StartSessionRow> {
    const client = getSupabaseAdminClient();

    const v2 = await client.rpc("ody_start_session", {
      p_display_name: input.displayName,
      p_storyline_id: input.storylineId,
      p_chapter_id: input.chapterId,
      p_start_node_id: input.startNodeId,
      p_day_night: input.dayNight,
      p_session_ttl_seconds: SESSION_TTL_SECONDS
    });

    if (!v2.error) {
      const row = (v2.data as StartSessionRow[] | null)?.[0];
      if (!row) {
        throw new Error("session_start_failed");
      }
      return row;
    }

    if (this.isLegacyStartSessionSignature(v2.error)) {
      const legacy = await client.rpc("ody_start_session", {
        p_display_name: input.displayName,
        p_chapter_id: input.chapterId,
        p_start_node_id: input.startNodeId,
        p_day_night: input.dayNight,
        p_session_ttl_seconds: SESSION_TTL_SECONDS
      });

      if (legacy.error) {
        await this.handleStartSessionRpcError(legacy.error);
      }

      const row = (legacy.data as LegacyStartSessionRow[] | null)?.[0];
      if (!row) {
        throw new Error("session_start_failed");
      }

      return {
        ...row,
        storyline_id: input.storylineId
      };
    }

    if (this.isStartSessionRpcAmbiguousCreatedAt(v2.error)) {
      return this.startSessionDirect(input);
    }

    await this.handleStartSessionRpcError(v2.error);
    throw new Error("supabase_query_failed");
  }

  private isLegacyStartSessionSignature(error: SupabaseErrorLike): boolean {
    const payload = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    if (payload.includes("p_storyline_id")) return true;
    if (error.code === "PGRST202" && payload.includes("ody_start_session")) return true;
    return payload.includes("function") && payload.includes("ody_start_session") && payload.includes("does not exist");
  }

  private isStartSessionNameConflict(error: SupabaseErrorLike): boolean {
    const payload = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    if (error.code === "23505" && payload.includes("normalized_display_name")) return true;
    return payload.includes("duplicate key") && payload.includes("normalized_display_name");
  }

  private isStartSessionRpcAmbiguousCreatedAt(error: SupabaseErrorLike): boolean {
    const payload = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    return error.code === "42702" && payload.includes("created_at") && payload.includes("ambiguous");
  }

  private isUndefinedColumn(error: SupabaseErrorLike, columnName: string): boolean {
    const payload = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    return (error.code === "42703" || error.code === "PGRST204") && payload.includes(columnName.toLowerCase());
  }

  private async startSessionDirect(input: {
    displayName: string;
    storylineId: string;
    chapterId: string;
    startNodeId: string;
    dayNight: "DAY" | "NIGHT";
  }): Promise<StartSessionRow> {
    const client = getSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const normalized = normalizeDisplayName(input.displayName);

    // Best-effort cleanup so stale locks do not block new sessions.
    await Promise.allSettled([
      client.from("ody_name_locks").delete().lte("expires_at", nowIso),
      client.from("ody_sessions").delete().lte("expires_at", nowIso)
    ]);

    let playerId = "";
    let resolvedDisplayName = input.displayName;

    const { data: existingPlayer, error: existingPlayerError } = await client
      .from("ody_players")
      .select("id,display_name")
      .eq("normalized_display_name", normalized)
      .limit(1)
      .maybeSingle();

    if (existingPlayerError) {
      throw new Error("supabase_query_failed");
    }

    if (existingPlayer?.id) {
      playerId = existingPlayer.id as string;
      resolvedDisplayName = (existingPlayer.display_name as string | null) ?? input.displayName;
    } else {
      const { data: insertedPlayer, error: insertPlayerError } = await client
        .from("ody_players")
        .insert({
          display_name: input.displayName,
          normalized_display_name: normalized
        })
        .select("id,display_name")
        .single();

      if (insertPlayerError || !insertedPlayer?.id) {
        throw new Error("supabase_query_failed");
      }

      playerId = insertedPlayer.id as string;
      resolvedDisplayName = (insertedPlayer.display_name as string | null) ?? input.displayName;
    }

    const sessionId = `session-${crypto.randomUUID()}`;
    const sessionToken = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    let createdAt = nowIso;
    let updatedAt = nowIso;

    const withStoryline = await client
      .from("ody_sessions")
      .insert({
        id: sessionId,
        player_id: playerId,
        session_token: sessionToken,
        storyline_id: input.storylineId,
        chapter_id: input.chapterId,
        current_node_id: input.startNodeId,
        status: "ACTIVE",
        day_night: input.dayNight,
        expires_at: expiresAt
      })
      .select("created_at,updated_at")
      .single();

    if (withStoryline.error) {
      if (this.isUndefinedColumn(withStoryline.error, "storyline_id")) {
        const legacy = await client
          .from("ody_sessions")
          .insert({
            id: sessionId,
            player_id: playerId,
            session_token: sessionToken,
            chapter_id: input.chapterId,
            current_node_id: input.startNodeId,
            status: "ACTIVE",
            day_night: input.dayNight,
            expires_at: expiresAt
          })
          .select("created_at,updated_at")
          .single();

        if (legacy.error) {
          throw new Error("supabase_query_failed");
        }

        createdAt = (legacy.data?.created_at as string | null) ?? nowIso;
        updatedAt = (legacy.data?.updated_at as string | null) ?? nowIso;
      } else {
        throw new Error("supabase_query_failed");
      }
    } else {
      createdAt = (withStoryline.data?.created_at as string | null) ?? nowIso;
      updatedAt = (withStoryline.data?.updated_at as string | null) ?? nowIso;
    }

    const { error: lockError } = await client.from("ody_name_locks").insert({
      normalized_display_name: normalized,
      display_name: resolvedDisplayName,
      session_id: sessionId,
      expires_at: expiresAt
    });

    if (lockError) {
      await client.from("ody_sessions").delete().eq("id", sessionId);
      if (this.isStartSessionNameConflict(lockError)) {
        throw new NameConflictError(await this.buildNameSuggestions(5));
      }
      throw new Error("supabase_query_failed");
    }

    const { error: visitedError } = await client.from("ody_visited_nodes").upsert(
      {
        session_id: sessionId,
        node_id: input.startNodeId
      },
      { onConflict: "session_id,node_id" }
    );
    if (visitedError) {
      throw new Error("supabase_query_failed");
    }

    const checkpointWithStoryline = await client.from("ody_footprint_checkpoints").insert({
      checkpoint_id: `cp-${sessionId}-1`,
      session_id: sessionId,
      storyline_id: input.storylineId,
      chapter_id: input.chapterId,
      node_id: input.startNodeId,
      plot_cursor: 0,
      metadata: { reason: "chapter_start" }
    });

    if (checkpointWithStoryline.error) {
      if (
        this.isUndefinedColumn(checkpointWithStoryline.error, "storyline_id") ||
        this.isUndefinedColumn(checkpointWithStoryline.error, "chapter_id")
      ) {
        const checkpointLegacy = await client.from("ody_footprint_checkpoints").insert({
          checkpoint_id: `cp-${sessionId}-1`,
          session_id: sessionId,
          node_id: input.startNodeId,
          plot_cursor: 0,
          metadata: { reason: "chapter_start" }
        });
        if (checkpointLegacy.error) {
          throw new Error("supabase_query_failed");
        }
      } else {
        throw new Error("supabase_query_failed");
      }
    }

    const { error: sidequestError } = await client.from("ody_sidequest_states").upsert(
      {
        session_id: sessionId,
        state: "IDLE",
        updated_at: nowIso
      },
      { onConflict: "session_id" }
    );

    if (sidequestError) {
      throw new Error("supabase_query_failed");
    }

    return {
      session_id: sessionId,
      session_token: sessionToken,
      player_id: playerId,
      display_name: resolvedDisplayName,
      storyline_id: input.storylineId,
      chapter_id: input.chapterId,
      current_node_id: input.startNodeId,
      day_night: input.dayNight,
      status: "ACTIVE",
      created_at: createdAt,
      updated_at: updatedAt,
      name_conflict: false
    };
  }

  private async handleStartSessionRpcError(error: SupabaseErrorLike): Promise<never> {
    if (this.isStartSessionNameConflict(error)) {
      throw new NameConflictError(await this.buildNameSuggestions(5));
    }

    if (error.message === "invalid_display_name" || error.message === "chapter_disabled") {
      throw new Error(error.message);
    }

    console.error("[odyssey] startSession rpc failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw new Error("supabase_query_failed");
  }
}

const globalForStore = globalThis as unknown as {
  __odyssey_store?: SupabaseGameStore;
};

export const gameStore = globalForStore.__odyssey_store ?? new SupabaseGameStore();

if (!globalForStore.__odyssey_store) {
  globalForStore.__odyssey_store = gameStore;
}
