import { createHash } from "node:crypto";
import { compileComicSequence, prepareComicStoryboardPlan } from "@odyssey/comic-dsl";
import {
  compiledComicSequenceSchema,
  type ComicPanel,
  type ComicSequenceRequest,
  type ComicStoryboardBeat,
  type ComicStoryboardPlan,
  type CompiledComicSequence,
  type DialogueNode
} from "@odyssey/shared";
import { chapterResourceManager } from "@/lib/server/chapter-resource-manager";
import { gameStore } from "@/lib/server/game-store";
import { attachReplicateIllustrations } from "@/lib/server/replicate-comic-renderer";
import { getSupabaseAdminClient } from "@/lib/server/supabase";

type ResolveComicSequenceInput = Omit<ComicSequenceRequest, "style"> & {
  style?: ComicSequenceRequest["style"];
  sessionToken: string;
};

type ComicCacheRow = {
  source_hash: string | null;
  payload: unknown;
};

type PreparedPlan = {
  actId?: string;
  plan: ComicStoryboardPlan;
  panelHints: Array<{
    panelId: string;
    index?: number;
    sceneId?: string;
    title?: string;
    text?: string;
    layout?: Partial<ComicPanel["layout"]>;
    camera?: Partial<ComicPanel["camera"]>;
    caption?: ComicPanel["caption"];
    speech?: ComicPanel["speech"];
    sfxTexts?: ComicPanel["sfxTexts"];
    fxTags?: string[];
    paletteToken?: string;
    illustration?: ComicPanel["illustration"];
  }>;
  bubbleThemeId?: string;
  bubbleTheme?: CompiledComicSequence["meta"]["bubbleTheme"];
  storyboardMarkdown?: string;
  warnings: string[];
};

const COMIC_STYLE_CONFIG = {
  hero_bright: {
    panelEdge: "thick_ink",
    paletteDay: "hero-day-amber",
    paletteNight: "hero-night-cobalt"
  }
} as const;

function appendWarnings(sequence: CompiledComicSequence, warnings: string[]): CompiledComicSequence {
  if (!warnings.length) return sequence;
  const mergedWarnings = [...new Set([...sequence.meta.warnings, ...warnings])];
  return compiledComicSequenceSchema.parse({
    ...sequence,
    meta: {
      ...sequence.meta,
      warnings: mergedWarnings
    }
  });
}

function toBeatsFromText(params: {
  text: string;
  sceneId: string;
  beatPrefix: string;
  emphasisBase?: number;
}): ComicStoryboardBeat[] {
  const chunks = params.text
    .split(/[。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const beats = (chunks.length ? chunks : [params.text]).slice(0, 4).map((chunk, idx) => ({
    beatId: `${params.beatPrefix}-${idx + 1}`,
    text: chunk,
    sceneId: params.sceneId,
    emphasis: Math.min(1, Math.max(0, (params.emphasisBase ?? 0.55) + idx * 0.08))
  }));

  return beats.length
    ? beats
    : [{ beatId: `${params.beatPrefix}-1`, text: "命运正在聚焦。", sceneId: params.sceneId, emphasis: 0.55 }];
}

function buildFallbackPlan(params: {
  sequenceId: string;
  source: "chapter_intro" | "dialogue_node";
  style: "hero_bright";
  text: string;
  sceneId: string;
  beatPrefix: string;
}): ComicStoryboardPlan {
  const beats = toBeatsFromText({
    text: params.text,
    sceneId: params.sceneId,
    beatPrefix: params.beatPrefix,
    emphasisBase: params.source === "chapter_intro" ? 0.6 : 0.52
  });
  const maxCount = Math.max(1, Math.min(4, beats.length));
  return {
    dslVersion: "1",
    sequenceId: params.sequenceId,
    sourceType: params.source,
    style: params.style,
    beats,
    rules: {
      panelCountMin: Math.max(1, Math.min(2, beats.length)),
      panelCountMax: maxCount,
      readingOrder: "ltr_ttb"
    }
  };
}

function buildFingerprint(payload: unknown): string {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

function buildCacheKey(params: {
  source: "chapter_intro" | "dialogue_node";
  storylineId: string;
  chapterId: string;
  nodeId?: string;
  actId?: string;
  dayNight: "DAY" | "NIGHT";
  branchTag?: string;
  style: "hero_bright";
}): string {
  return [
    params.source,
    params.storylineId,
    params.chapterId,
    params.nodeId ?? "_",
    params.actId ?? "_",
    params.dayNight,
    params.branchTag ?? "_",
    params.style
  ].join(":");
}

function buildSequenceId(params: {
  source: "chapter_intro" | "dialogue_node";
  storylineId: string;
  chapterId: string;
  nodeId?: string;
}): string {
  if (params.source === "chapter_intro") {
    return `comic:${params.storylineId}:${params.chapterId}:intro`;
  }

  return `comic:${params.storylineId}:${params.chapterId}:${params.nodeId ?? "_"}`;
}

function withContextFields(params: {
  base: CompiledComicSequence;
  sourceHash: string;
  storylineId: string;
  chapterId: string;
  nodeId?: string;
  actId?: string;
  bubbleThemeId?: string;
  bubbleTheme?: CompiledComicSequence["meta"]["bubbleTheme"];
}): CompiledComicSequence {
  return compiledComicSequenceSchema.parse({
    ...params.base,
    storylineId: params.storylineId,
    chapterId: params.chapterId,
    nodeId: params.nodeId,
    meta: {
      ...params.base.meta,
      sourceHash: params.sourceHash,
      actId: params.actId ?? params.base.meta.actId,
      bubbleThemeId: params.bubbleThemeId ?? params.base.meta.bubbleThemeId,
      bubbleTheme: params.bubbleTheme ?? params.base.meta.bubbleTheme
    }
  });
}

function buildFallbackSequence(params: {
  source: "chapter_intro" | "dialogue_node";
  storylineId: string;
  chapterId: string;
  nodeId?: string;
  text: string;
  sourceHash: string;
  actId?: string;
  bubbleThemeId?: string;
  bubbleTheme?: CompiledComicSequence["meta"]["bubbleTheme"];
  warnings?: string[];
}): CompiledComicSequence {
  const warnings = [...new Set(["fallback_sequence_used", ...(params.warnings ?? [])])];
  const panels: ComicPanel[] = [
    {
      panelId: "fallback-1",
      index: 0,
      layout: { x: 0.03, y: 0.03, w: 0.94, h: 0.94 },
      camera: { shot: "medium", angle: "eye", tiltDeg: 0 },
      caption: { title: "剧情继续", text: params.text },
      speech: [
        {
          speaker: "旁白",
          text: params.text,
          bubbleStyle: "normal",
          anchor: { x: 0.12, y: 0.16 },
          renderHint: {
            variant: "default",
            emphasis: 0.5
          }
        }
      ],
      sfxTexts: [],
      fxTags: ["halftone"],
      paletteToken: "hero-day-amber"
    }
  ];

  return compiledComicSequenceSchema.parse({
    sequenceId: `comic:fallback:${params.storylineId}:${params.chapterId}:${params.nodeId ?? "_"}`,
    sourceType: params.source,
    storylineId: params.storylineId,
    chapterId: params.chapterId,
    nodeId: params.nodeId,
    style: "hero_bright",
    panels,
    meta: {
      dslVersion: "1",
      sourceHash: params.sourceHash,
      compiledAt: new Date().toISOString(),
      actId: params.actId,
      bubbleThemeId: params.bubbleThemeId,
      bubbleTheme: params.bubbleTheme,
      warnings
    }
  });
}

async function tryReadCache(cacheKey: string): Promise<ComicCacheRow | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("ody_comic_cache")
    .select("source_hash,payload")
    .eq("cache_key", cacheKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ComicCacheRow;
}

async function tryWriteCache(params: {
  cacheKey: string;
  sequence: CompiledComicSequence;
  sourceType: "chapter_intro" | "dialogue_node";
  storylineId: string;
  chapterId: string;
  nodeId?: string;
  sourceHash: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await getSupabaseAdminClient().from("ody_comic_cache").upsert(
    {
      cache_key: params.cacheKey,
      storyline_id: params.storylineId,
      chapter_id: params.chapterId,
      node_id: params.nodeId ?? null,
      source_type: params.sourceType,
      style: params.sequence.style,
      source_hash: params.sourceHash,
      payload: params.sequence,
      created_at: now,
      updated_at: now
    },
    { onConflict: "cache_key" }
  );
}

function resolveTargetNode(params: {
  chapterNodes: Record<string, DialogueNode>;
  currentNode: DialogueNode;
  requestedNodeId?: string;
}): DialogueNode {
  if (!params.requestedNodeId || params.requestedNodeId === params.currentNode.id) {
    return params.currentNode;
  }

  return params.chapterNodes[params.requestedNodeId] ?? params.currentNode;
}

async function preparePlan(params: {
  source: "chapter_intro" | "dialogue_node";
  storylineId: string;
  chapterId: string;
  nodeId?: string;
  targetNode: DialogueNode;
  style: "hero_bright";
  sequenceId: string;
  requestedActId?: string;
}): Promise<PreparedPlan> {
  try {
    const prepared = await prepareComicStoryboardPlan({
      storylineId: params.storylineId,
      chapterId: params.chapterId,
      sourceType: params.source,
      sequenceId: params.sequenceId,
      nodeId: params.nodeId,
      sceneId: params.targetNode.sceneId,
      nodeText: params.source === "dialogue_node" ? params.targetNode.content : undefined,
      fallbackText: params.targetNode.content,
      requestedActId: params.requestedActId,
      style: params.style
    });

    return {
      actId: prepared.actId,
      plan: prepared.plan,
      panelHints: prepared.panelHints,
      bubbleThemeId: prepared.bubbleTheme.themeId,
      bubbleTheme: prepared.bubbleTheme,
      storyboardMarkdown: prepared.storyboardMarkdown,
      warnings: prepared.warnings
    };
  } catch {
    return {
      actId: params.requestedActId,
      plan: buildFallbackPlan({
        sequenceId: params.sequenceId,
        source: params.source,
        style: params.style,
        text: params.targetNode.content || "旅程继续推进。",
        sceneId: params.targetNode.sceneId,
        beatPrefix: params.nodeId ?? "fallback"
      }),
      panelHints: [],
      warnings: ["act_plan_prepare_failed"]
    };
  }
}

export async function resolveComicSequence(input: ResolveComicSequenceInput): Promise<CompiledComicSequence> {
  const context = await gameStore.getComicContext(input.sessionId, input.sessionToken);
  const style = input.style ?? "hero_bright";
  const storylineId = context.session.storylineId;
  const chapterId = context.session.chapterId;
  const chapterBundle = await chapterResourceManager.loadChapterBundle(storylineId, chapterId);

  const targetNode = resolveTargetNode({
    chapterNodes: chapterBundle.nodes,
    currentNode: context.node,
    requestedNodeId: input.nodeId
  });

  const nodeId = input.source === "dialogue_node" ? targetNode.id : undefined;
  const sequenceId = buildSequenceId({
    source: input.source,
    storylineId,
    chapterId,
    nodeId
  });

  const prepared = await preparePlan({
    source: input.source,
    storylineId,
    chapterId,
    nodeId,
    targetNode,
    style,
    sequenceId,
    requestedActId: input.actId
  });

  const sourceHash = buildFingerprint({
    source: input.source,
    style,
    storylineId,
    chapterId,
    nodeId,
    actId: prepared.actId,
    dayNight: context.dayNight,
    branchTag: context.branchTag,
    chapterMeta: chapterBundle.meta,
    styleConfig: COMIC_STYLE_CONFIG[style],
    node: input.source === "dialogue_node" ? targetNode : undefined,
    plan: prepared.plan,
    panelHints: prepared.panelHints,
    bubbleThemeId: prepared.bubbleThemeId,
    bubbleTheme: prepared.bubbleTheme,
    storyboardMarkdown: prepared.storyboardMarkdown
  });

  const cacheKey = buildCacheKey({
    source: input.source,
    storylineId,
    chapterId,
    nodeId,
    actId: prepared.actId,
    dayNight: context.dayNight,
    branchTag: context.branchTag,
    style
  });

  try {
    const cached = await tryReadCache(cacheKey);
    if (cached?.source_hash === sourceHash && cached.payload) {
      return compiledComicSequenceSchema.parse(cached.payload);
    }
  } catch {
    // Cache failures should not block page rendering.
  }

  try {
    const compiled = compileComicSequence({
      plan: prepared.plan,
      panelHints: prepared.panelHints,
      context: {
        dayNight: context.dayNight,
        branchTag: context.branchTag,
        sourceFingerprint: sourceHash
      },
      metadata: {
        storylineId,
        chapterId,
        nodeId,
        actId: prepared.actId,
        bubbleThemeId: prepared.bubbleThemeId,
        bubbleTheme: prepared.bubbleTheme
      }
    });

    const withContext = withContextFields({
      base: {
        ...compiled,
        sourceType: input.source,
        style
      },
      sourceHash,
      storylineId,
      chapterId,
      nodeId,
      actId: prepared.actId,
      bubbleThemeId: prepared.bubbleThemeId,
      bubbleTheme: prepared.bubbleTheme
    });

    const mergedWarnings = appendWarnings(withContext, prepared.warnings);
    const sequence = await attachReplicateIllustrations(mergedWarnings);

    try {
      await tryWriteCache({
        cacheKey,
        sequence,
        sourceType: input.source,
        storylineId,
        chapterId,
        nodeId,
        sourceHash
      });
    } catch {
      // Cache write failures should not block page rendering.
    }

    return sequence;
  } catch {
    return buildFallbackSequence({
      source: input.source,
      storylineId,
      chapterId,
      nodeId,
      text: targetNode.content || "旅程继续推进。",
      sourceHash,
      actId: prepared.actId,
      bubbleThemeId: prepared.bubbleThemeId,
      bubbleTheme: prepared.bubbleTheme,
      warnings: prepared.warnings
    });
  }
}
