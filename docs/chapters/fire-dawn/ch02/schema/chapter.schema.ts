import { z } from "zod";

export const ch02NodeSchema = z.object({
  id: z.string(),
  sceneId: z.string(),
  speaker: z.string(),
  content: z.string(),
  checkpoint: z.boolean().default(false)
});

export const ch02ChoiceSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  label: z.string(),
  nextNodeId: z.string(),
  branchTag: z.string().optional(),
  nextChapterId: z.string().optional()
});
