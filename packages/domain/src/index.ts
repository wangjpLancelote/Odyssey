import type { BloodlineState, PlotEdge, Rank, WordSpirit } from "@odyssey/shared";

export * from "./chapter-registry";

export const defaultWordSpirits: WordSpirit[] = [
  {
    code: "A-01",
    title: "君焰",
    tier: 6,
    cooldownMs: 10000,
    cost: 18
  },
  {
    code: "B-12",
    title: "镰鼬",
    tier: 4,
    cooldownMs: 5000,
    cost: 8
  }
];

export const defaultBloodlineState: BloodlineState = {
  purity: 42,
  stability: 61,
  corruption: 8
};

export const defaultRank: Rank = "B";

export const canonicalRules = [
  "rule-bloodline-cap",
  "rule-word-spirit-tier-lock",
  "rule-character-knowledge-boundary",
  "rule-timeline-consistency"
] as const;

const rankThreshold: Record<Rank, number> = {
  S: 90,
  A: 75,
  B: 55,
  C: 35,
  D: 0
};

export function evaluateRankFromBloodline(purity: number): Rank {
  if (purity >= rankThreshold.S) return "S";
  if (purity >= rankThreshold.A) return "A";
  if (purity >= rankThreshold.B) return "B";
  if (purity >= rankThreshold.C) return "C";
  return "D";
}

export function canCastWordSpirit(
  rank: Rank,
  bloodline: BloodlineState,
  spirit: WordSpirit
): boolean {
  const rankValue: Record<Rank, number> = { S: 5, A: 4, B: 3, C: 2, D: 1 };
  if (bloodline.stability < 30 && spirit.tier > 3) return false;
  return rankValue[rank] >= Math.ceil(spirit.tier / 2);
}

export function buildPlotEdge(
  fromNodeId: string,
  toNodeId: string,
  choiceId: string
): PlotEdge {
  return {
    fromNodeId,
    toNodeId,
    choiceId,
    createdAt: new Date().toISOString()
  };
}
