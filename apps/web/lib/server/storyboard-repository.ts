import { readFile } from "node:fs/promises";
import path from "node:path";
import { compileSceneTimeline } from "@odyssey/scene-dsl";
import {
  compileContextSchema,
  sceneStoryboardPlanSchema,
  storyboardModuleSchema,
  type CompiledSceneTimeline
} from "@odyssey/shared";
import { cutsceneDslManifest } from "@/lib/cutscene-specs";

const workspaceRoot = path.resolve(process.cwd(), "../..");
const modulesDir = path.resolve(workspaceRoot, "docs/storyboard/modules");
const plansDir = path.resolve(workspaceRoot, "docs/storyboard/plans");

async function readJsonFile<T>(absolutePath: string): Promise<T> {
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function loadCompiledTimeline(params: {
  cutsceneId: keyof typeof cutsceneDslManifest;
  dayNight: "DAY" | "NIGHT";
  branchTag?: string;
}): Promise<CompiledSceneTimeline> {
  const manifest = cutsceneDslManifest[params.cutsceneId];
  const [plan, modules] = await Promise.all([
    readJsonFile(path.resolve(plansDir, manifest.planFile)),
    Promise.all(manifest.moduleFiles.map((file) => readJsonFile(path.resolve(modulesDir, file))))
  ]);

  const validatedPlan = sceneStoryboardPlanSchema.parse(plan);
  const validatedModules = modules.map((module) => storyboardModuleSchema.parse(module));

  return compileSceneTimeline({
    plan: validatedPlan,
    modules: validatedModules,
    context: compileContextSchema.parse({
      dayNight: params.dayNight,
      branchTag: params.branchTag
    })
  });
}
