import type {
  BloodlineState,
  Chapter,
  DialogueNode,
  PlotEdge,
  Rank,
  WordSpirit
} from "@odyssey/shared";

export const cassellIntroChapter: Chapter = {
  id: "chapter-cassell-intro",
  slug: "cassell-intro",
  title: "卡塞尔入学",
  introCutsceneId: "cutscene-cassell-arrival",
  sceneOrder: ["scene-train", "scene-campus-gate", "scene-interview"],
  startNodeId: "node-train-awake"
};

export const cassellIntroNodes: Record<string, DialogueNode> = {
  "node-train-awake": {
    id: "node-train-awake",
    speaker: "路明非",
    content: "车窗外雨丝像被拉长的银线，陌生的录取通知在掌心发烫。",
    sceneId: "scene-train",
    checkpoint: true,
    choices: [
      {
        id: "choice-open-letter",
        label: "拆开通知书",
        nextNodeId: "node-letter-read",
        branchTag: "destiny_accept"
      },
      {
        id: "choice-ignore-letter",
        label: "先装作没看见",
        nextNodeId: "node-fake-calm",
        branchTag: "self_escape"
      }
    ]
  },
  "node-letter-read": {
    id: "node-letter-read",
    speaker: "旁白",
    content: "卡塞尔学院邀请你参加面试，命运像一扇开了一半的门。",
    sceneId: "scene-train",
    checkpoint: false,
    choices: [
      {
        id: "choice-proceed-campus",
        label: "前往学院",
        nextNodeId: "node-campus-gate"
      }
    ]
  },
  "node-fake-calm": {
    id: "node-fake-calm",
    speaker: "路明非",
    content: "我只是个普通人，和龙没关系。可那枚徽章却像在注视我。",
    sceneId: "scene-train",
    checkpoint: false,
    choices: [
      {
        id: "choice-reconsider",
        label: "还是去看看",
        nextNodeId: "node-campus-gate",
        branchTag: "destiny_return"
      }
    ]
  },
  "node-campus-gate": {
    id: "node-campus-gate",
    speaker: "诺诺",
    content: "欢迎来到卡塞尔。你不是误闯进来的人，你是被选中的人。",
    sceneId: "scene-campus-gate",
    checkpoint: true,
    choices: [
      {
        id: "choice-accept-test",
        label: "接受血统评估",
        nextNodeId: "node-interview-room",
        branchTag: "bloodline_awaken"
      },
      {
        id: "choice-question-fate",
        label: "质疑所谓宿命",
        nextNodeId: "node-interview-room",
        branchTag: "self_will"
      }
    ]
  },
  "node-interview-room": {
    id: "node-interview-room",
    speaker: "古德里安",
    content: "你每一次选择都在改写未来，但不会抹去你是谁。",
    sceneId: "scene-interview",
    checkpoint: true,
    choices: []
  }
};

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
