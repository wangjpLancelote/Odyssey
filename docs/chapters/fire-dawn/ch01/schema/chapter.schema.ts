import { z } from "zod";

export const ch01NodeSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  speaker: z.string(),
  content: z.string(),
  checkpoint: z.boolean().default(false)
});

export const ch01ChoiceSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  label: z.string(),
  nextNodeId: z.string(),
  branchTag: z.string().optional(),
  nextChapterId: z.string().optional()
});
