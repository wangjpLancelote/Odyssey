import { createHash } from "node:crypto";
import {
  chapterIntroPanelSchema,
  comicCompileContextSchema,
  comicStoryboardPlanSchema,
  compiledComicSequenceSchema,
  type ChapterIntroPanel,
  type ComicBubbleTheme,
  type ComicCompileContext,
  type ComicPanel,
  type ComicStoryboardPlan,
  type CompiledComicSequence
} from "@odyssey/shared";
export * from "./act-content";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildLayouts(panelCount: number): Array<{ x: number; y: number; w: number; h: number }> {
  if (panelCount <= 1) {
    return [{ x: 0.02, y: 0.02, w: 0.96, h: 0.96 }];
  }

  if (panelCount === 2) {
    return [
      { x: 0.02, y: 0.02, w: 0.96, h: 0.47 },
      { x: 0.02, y: 0.51, w: 0.96, h: 0.47 }
    ];
  }

  if (panelCount === 3) {
    return [
      { x: 0.02, y: 0.02, w: 0.62, h: 0.96 },
      { x: 0.66, y: 0.02, w: 0.32, h: 0.47 },
      { x: 0.66, y: 0.51, w: 0.32, h: 0.47 }
    ];
  }

  return [
    { x: 0.02, y: 0.02, w: 0.47, h: 0.47 },
    { x: 0.51, y: 0.02, w: 0.47, h: 0.47 },
    { x: 0.02, y: 0.51, w: 0.47, h: 0.47 },
    { x: 0.51, y: 0.51, w: 0.47, h: 0.47 }
  ];
}

function chooseShot(emphasis: number, index: number): ComicPanel["camera"]["shot"] {
  if (emphasis >= 0.8) return "extreme_close";
  if (emphasis >= 0.55) return "close";
  return index === 0 ? "wide" : "medium";
}

function chooseAngle(mood?: string): ComicPanel["camera"]["angle"] {
  const m = (mood ?? "").toLowerCase();
  if (m.includes("hero") || m.includes("resolve")) return "low";
  if (m.includes("pressure") || m.includes("fear")) return "high";
  return "eye";
}

function chooseFxTags(text: string, mood?: string): string[] {
  const fx = ["halftone", "ink_outline"];
  const lower = `${text} ${mood ?? ""}`.toLowerCase();
  if (lower.includes("冲") || lower.includes("炸") || lower.includes("impact")) {
    fx.push("speedline");
  }
  if (lower.includes("hero") || lower.includes("希望") || lower.includes("黎明")) {
    fx.push("hero_rim_light");
  }
  return fx;
}

function choosePalette(dayNight: ComicCompileContext["dayNight"]): string {
  return dayNight === "DAY" ? "hero-day-amber" : "hero-night-cobalt";
}

export function compileComicSequence(input: {
  plan: ComicStoryboardPlan;
  context: ComicCompileContext;
  panelHints?: ChapterIntroPanel[];
  metadata?: {
    storylineId?: string;
    chapterId?: string;
    nodeId?: string;
    actId?: string;
    bubbleThemeId?: string;
    bubbleTheme?: ComicBubbleTheme;
  };
}): CompiledComicSequence {
  const plan = comicStoryboardPlanSchema.parse(input.plan);
  const context = comicCompileContextSchema.parse(input.context);
  const panelHints = (input.panelHints ?? []).map((hint) => chapterIntroPanelSchema.parse(hint));
  const warnings: string[] = [];

  const minCount = Math.max(1, plan.rules.panelCountMin);
  const maxCount = Math.max(minCount, plan.rules.panelCountMax);
  const panelCount = clamp(plan.beats.length, minCount, maxCount);
  const selectedBeats = plan.beats.slice(0, panelCount);

  if (plan.beats.length > panelCount) {
    warnings.push(`beat_truncated:${plan.beats.length - panelCount}`);
  }

  const layouts = buildLayouts(panelCount);
  const panels: ComicPanel[] = selectedBeats.map((beat, index) => {
    const emphasis = clamp(beat.emphasis ?? 0.5, 0, 1);
    const defaultBubbleStyle = emphasis >= 0.78 ? "shout" : emphasis <= 0.33 ? "whisper" : "normal";
    const generated: ComicPanel = {
      panelId: beat.beatId,
      index,
      layout: layouts[index] ?? { x: 0.02, y: 0.02, w: 0.96, h: 0.96 },
      camera: {
        shot: chooseShot(emphasis, index),
        angle: chooseAngle(beat.mood),
        tiltDeg: emphasis >= 0.7 ? 2 : 0
      },
      caption: {
        title: beat.sceneId,
        text: beat.text
      },
      speech: [
        {
          speaker: "旁白",
          text: beat.text,
          bubbleStyle: defaultBubbleStyle,
          anchor: { x: 0.12, y: 0.16 },
          renderHint: {
            variant: emphasis >= 0.78 ? "impact" : emphasis <= 0.33 ? "soft" : "default",
            emphasis
          }
        }
      ],
      sfxTexts:
        emphasis >= 0.75
          ? [
              {
                text: "BAM",
                style: "impact",
                anchor: { x: 0.82, y: 0.2 },
                rotateDeg: -8
              }
            ]
          : [],
      fxTags: chooseFxTags(beat.text, beat.mood),
      paletteToken: choosePalette(context.dayNight)
    };

    const hint = panelHints[index];
    if (!hint) {
      return generated;
    }

    const speechWithHints = (hint.speech?.length ? hint.speech : generated.speech).map((speech) => ({
      ...speech,
      renderHint: speech.renderHint ?? {
        variant: emphasis >= 0.78 ? "impact" : emphasis <= 0.33 ? "soft" : "default",
        emphasis
      }
    }));

    return {
      ...generated,
      panelId: hint.panelId ?? generated.panelId,
      layout: {
        ...generated.layout,
        ...(hint.layout ?? {})
      },
      camera: {
        ...generated.camera,
        ...(hint.camera ?? {})
      },
      caption: hint.caption
        ? hint.caption
        : {
            title: hint.title ?? generated.caption?.title,
            text: hint.text ?? generated.caption?.text
          },
      speech: speechWithHints,
      sfxTexts: hint.sfxTexts ?? generated.sfxTexts,
      fxTags: hint.fxTags ?? generated.fxTags,
      paletteToken: hint.paletteToken ?? generated.paletteToken,
      illustration: hint.illustration ?? generated.illustration
    };
  });

  const sourceHash = createHash("sha1")
    .update(
      JSON.stringify({
        plan,
        context
      })
    )
    .digest("hex");

  return compiledComicSequenceSchema.parse({
    sequenceId: plan.sequenceId,
    sourceType: plan.sourceType,
    storylineId: input.metadata?.storylineId ?? "unknown",
    chapterId: input.metadata?.chapterId ?? "unknown",
    nodeId: input.metadata?.nodeId,
    style: plan.style,
    panels,
    meta: {
      dslVersion: plan.dslVersion,
      sourceHash,
      compiledAt: new Date().toISOString(),
      actId: input.metadata?.actId,
      bubbleThemeId: input.metadata?.bubbleThemeId,
      bubbleTheme: input.metadata?.bubbleTheme,
      warnings
    }
  });
}
