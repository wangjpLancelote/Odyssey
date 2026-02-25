import { createHash } from "node:crypto";
import {
  compiledSceneTimelineSchema,
  sceneStoryboardPlanSchema,
  storyboardModuleSchema,
  type CompileContext,
  type CompiledSceneTimeline,
  type SceneStoryboardPlan,
  type StoryboardModule,
  type TimelineStep
} from "@odyssey/shared";

export class SceneDslCompileError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type CompileInput = {
  modules: StoryboardModule[];
  plan: SceneStoryboardPlan;
  context: CompileContext;
};

function conditionMatch(context: CompileContext, when?: { dayNight?: "DAY" | "NIGHT"; branchTag?: string }): boolean {
  if (!when) return true;
  if (when.dayNight && when.dayNight !== context.dayNight) return false;
  if (when.branchTag && when.branchTag !== context.branchTag) return false;
  return true;
}

function applyPatch(step: TimelineStep, field: string, value: string | number | boolean): TimelineStep {
  if (field === "atMs") return { ...step, atMs: Number(value) };
  if (field === "durationMs") return { ...step, durationMs: Number(value) };
  if (field === "priority") return { ...step, priority: Number(value) };
  if (field === "ease") return { ...step, ease: String(value) };
  if (field.startsWith("from.")) {
    const key = field.slice("from.".length);
    return { ...step, from: { ...step.from, [key]: value } };
  }
  if (field.startsWith("to.")) {
    const key = field.slice("to.".length);
    return { ...step, to: { ...step.to, [key]: value } };
  }

  throw new SceneDslCompileError("SCENE_DSL_INVALID_OVERRIDE_FIELD", `Unsupported patch field: ${field}`);
}

function uniqBy<T>(items: T[], keyFn: (item: T) => string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      throw new SceneDslCompileError("SCENE_DSL_DUPLICATE_ID", `Duplicate id detected: ${key}`);
    }
    seen.add(key);
  }
}

export function compileSceneTimeline(input: CompileInput): CompiledSceneTimeline {
  const plan = sceneStoryboardPlanSchema.parse(input.plan);
  const modules = input.modules.map((module) => storyboardModuleSchema.parse(module));

  uniqBy(modules, (module) => module.moduleId);
  uniqBy(plan.instances, (instance) => instance.instanceId);

  const moduleMap = new Map(modules.map((module) => [module.moduleId, module]));
  const warnings: string[] = [];
  const motions: TimelineStep[] = [];
  const audios = [] as CompiledSceneTimeline["audios"];

  for (const instance of plan.instances) {
    if (!conditionMatch(input.context, instance.when)) {
      continue;
    }

    const module = moduleMap.get(instance.moduleId);
    if (!module) {
      throw new SceneDslCompileError(
        "SCENE_DSL_MODULE_NOT_FOUND",
        `Module ${instance.moduleId} not found for instance ${instance.instanceId}`
      );
    }

    uniqBy(module.motions, (motion) => motion.id);
    uniqBy(module.audios, (audio) => audio.id);

    const localMotionMap = new Map(module.motions.map((motion) => [motion.id, { ...motion }]));
    const localAudios = module.audios.map((audio) => ({ ...audio }));

    for (const patch of instance.overrides) {
      const motion = localMotionMap.get(patch.atomId);
      if (motion) {
        localMotionMap.set(patch.atomId, applyPatch(motion, patch.field, patch.value));
        continue;
      }

      const audioIdx = localAudios.findIndex((audio) => audio.id === patch.atomId);
      if (audioIdx >= 0) {
        if (patch.field !== "volume" && patch.field !== "fadeInMs" && patch.field !== "fadeOutMs" && patch.field !== "atMs") {
          throw new SceneDslCompileError("SCENE_DSL_INVALID_OVERRIDE_FIELD", `Unsupported audio patch field: ${patch.field}`);
        }

        localAudios[audioIdx] = {
          ...localAudios[audioIdx],
          [patch.field]: patch.field === "volume" ? Number(patch.value) : Number(patch.value)
        };
        continue;
      }

      throw new SceneDslCompileError("SCENE_DSL_ATOM_NOT_FOUND", `Patch atom ${patch.atomId} not found`);
    }

    for (const motion of localMotionMap.values()) {
      motions.push({
        ...motion,
        id: `${instance.instanceId}:${motion.id}`,
        atMs: motion.atMs + instance.offsetMs
      });
    }

    for (const audio of localAudios) {
      audios.push({
        ...audio,
        id: `${instance.instanceId}:${audio.id}`,
        atMs: audio.atMs + instance.offsetMs
      });
    }
  }

  motions.sort((a, b) => a.atMs - b.atMs || b.priority - a.priority || a.id.localeCompare(b.id));
  audios.sort((a, b) => a.atMs - b.atMs || a.id.localeCompare(b.id));

  const seenConflict = new Set<string>();
  for (const motion of motions) {
    const key = `${motion.atMs}:${motion.kind}:${motion.target}`;
    if (seenConflict.has(key)) {
      warnings.push(`conflict:${key}`);
    }
    seenConflict.add(key);
  }

  const sourceHash = createHash("sha1")
    .update(JSON.stringify({ plan, modules, context: input.context }))
    .digest("hex");

  return compiledSceneTimelineSchema.parse({
    cutsceneId: plan.cutsceneId,
    sceneId: plan.sceneId,
    motions,
    audios,
    meta: {
      dslVersion: plan.dslVersion,
      compiledAt: new Date().toISOString(),
      sourceHash,
      warnings
    }
  });
}
