import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { compileComicSequence, prepareComicStoryboardPlan } from "@odyssey/comic-dsl";
import {
  comicSourceTypeSchema,
  comicStyleVariantSchema,
  compiledComicSequenceSchema,
  type ChapterIntroPanel,
  type ComicStoryboardPlan,
  type CompiledComicSequence
} from "@odyssey/shared";
import { z } from "zod";
import { chapterResourceManager } from "@/lib/server/chapter-resource-manager";
import { apiError } from "@/lib/server/http";
import { attachReplicateIllustrations } from "@/lib/server/replicate-comic-renderer";

const comicDemoSequenceRequestSchema = z.object({
  storylineId: z.string().default("fire-dawn"),
  chapterId: z.string().default("ch01"),
  source: comicSourceTypeSchema.default("chapter_intro"),
  nodeId: z.string().optional(),
  actId: z.string().optional(),
  style: comicStyleVariantSchema.default("hero_bright"),
  dayNight: z.enum(["DAY", "NIGHT"]).default("DAY"),
  branchTag: z.string().optional()
});
type ComicDemoSequenceRequest = z.output<typeof comicDemoSequenceRequestSchema>;

function fallbackPlan(params: {
  sequenceId: string;
  source: "chapter_intro" | "dialogue_node";
  style: "hero_bright";
  sceneId: string;
  text: string;
}): ComicStoryboardPlan {
  return {
    dslVersion: "1",
    sequenceId: params.sequenceId,
    sourceType: params.source,
    style: params.style,
    beats: [
      {
        beatId: `${params.sequenceId}-fallback`,
        text: params.text || "命运在下一格继续。",
        sceneId: params.sceneId || "fallback-scene",
        emphasis: 0.54
      }
    ],
    rules: {
      panelCountMin: 1,
      panelCountMax: 1,
      readingOrder: "ltr_ttb"
    }
  };
}

function mergeWarnings(sequence: CompiledComicSequence, warnings: string[]): CompiledComicSequence {
  if (!warnings.length) return sequence;
  return compiledComicSequenceSchema.parse({
    ...sequence,
    meta: {
      ...sequence.meta,
      warnings: [...new Set([...sequence.meta.warnings, ...warnings])]
    }
  });
}

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "comic_demo_disabled" }, { status: 403 });
    }

    const body: ComicDemoSequenceRequest = comicDemoSequenceRequestSchema.parse(await req.json());
    const chapterBundle = await chapterResourceManager.loadChapterBundle(body.storylineId, body.chapterId);
    const chapterMeta = chapterBundle.meta;
    const currentNode = chapterBundle.nodes[body.nodeId ?? chapterMeta.startNodeId] ?? chapterBundle.nodes[chapterMeta.startNodeId];
    if (!currentNode) {
      return NextResponse.json({ error: "node_not_found" }, { status: 404 });
    }

    const nodeId = body.source === "dialogue_node" ? currentNode.id : undefined;
    const sequenceId =
      body.source === "chapter_intro"
        ? `comic:${body.storylineId}:${body.chapterId}:intro:demo`
        : `comic:${body.storylineId}:${body.chapterId}:${nodeId ?? "_"}:demo`;

    let plan: ComicStoryboardPlan;
    let panelHints: ChapterIntroPanel[] = [];
    let bubbleThemeId: string | undefined;
    let bubbleTheme: CompiledComicSequence["meta"]["bubbleTheme"];
    const warnings: string[] = [];

    try {
      const prepared = await prepareComicStoryboardPlan({
        storylineId: body.storylineId,
        chapterId: body.chapterId,
        sourceType: body.source,
        sequenceId,
        nodeId,
        sceneId: currentNode.sceneId,
        nodeText: body.source === "dialogue_node" ? currentNode.content : undefined,
        fallbackText: currentNode.content,
        requestedActId: body.actId,
        style: body.style
      });
      plan = prepared.plan;
      panelHints = prepared.panelHints;
      bubbleTheme = prepared.bubbleTheme;
      bubbleThemeId = prepared.bubbleTheme.themeId;
      warnings.push(...prepared.warnings);
    } catch {
      plan = fallbackPlan({
        sequenceId,
        source: body.source,
        style: body.style,
        sceneId: currentNode.sceneId,
        text: currentNode.content
      });
      warnings.push("demo_prepare_failed_fallback");
    }

    const sourceFingerprint = createHash("sha1")
      .update(
        JSON.stringify({
          storylineId: body.storylineId,
          chapterId: body.chapterId,
          nodeId,
          source: body.source,
          style: body.style,
          dayNight: body.dayNight,
          branchTag: body.branchTag,
          plan
        })
      )
      .digest("hex");

    const compiled = compileComicSequence({
      plan,
      panelHints,
      context: {
        dayNight: body.dayNight,
        branchTag: body.branchTag,
        sourceFingerprint
      },
      metadata: {
        storylineId: body.storylineId,
        chapterId: body.chapterId,
        nodeId,
        actId: body.actId,
        bubbleThemeId,
        bubbleTheme
      }
    });

    const merged = mergeWarnings(
      compiledComicSequenceSchema.parse({
        ...compiled,
        sourceType: body.source,
        style: body.style
      }),
      warnings
    );

    const illustrated = await attachReplicateIllustrations(merged);
    return NextResponse.json(illustrated);
  } catch (error) {
    return apiError(error);
  }
}
