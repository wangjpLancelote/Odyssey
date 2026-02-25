import type {
  SideQuestCandidate,
  SideQuestMachineInput,
  SideQuestMachineOutput,
  SideQuestState
} from "@odyssey/shared";

const stateTransitions: Record<SideQuestState, SideQuestState[]> = {
  IDLE: ["ELIGIBLE"],
  ELIGIBLE: ["GENERATING", "IDLE"],
  GENERATING: ["ACTIVE", "FAILED"],
  ACTIVE: ["RESOLVED", "FAILED"],
  RESOLVED: ["IDLE"],
  FAILED: ["IDLE"]
};

function assessEligibility(input: SideQuestMachineInput): boolean {
  const notBlocked = input.prohibitedCanonRules.length < 3;
  const enoughBloodline = input.bloodline.purity >= 30;
  return notBlocked && enoughBloodline;
}

function buildCandidate(input: SideQuestMachineInput): SideQuestCandidate {
  return {
    questId: `sq-${input.sessionId}-${input.nodeId}`,
    title: "雨夜试炼",
    hook: "学院档案室丢失了一页与龙文相关的资料，你被要求在天亮前找回。",
    startNodeId: input.nodeId,
    resolution: "你在孤独与信任之间做出选择，决定是否公开线索。",
    riskFlags: input.rank === "D" ? ["low_rank_high_risk"] : []
  };
}

export function runSideQuestStateMachine(
  input: SideQuestMachineInput,
  currentState: SideQuestState
): SideQuestMachineOutput {
  const candidateBranches: SideQuestCandidate[] = [];
  const riskFlags: string[] = [];
  const canonChecks: string[] = [];

  let nextState: SideQuestState = currentState;

  if (currentState === "IDLE" && assessEligibility(input)) {
    nextState = "ELIGIBLE";
  }

  if (nextState === "ELIGIBLE") {
    nextState = "GENERATING";
    candidateBranches.push(buildCandidate(input));
  }

  if (nextState === "GENERATING") {
    if (candidateBranches.length > 0) {
      nextState = "ACTIVE";
    } else {
      nextState = "FAILED";
      riskFlags.push("no_candidate_generated");
    }
  }

  if (!stateTransitions[currentState].includes(nextState)) {
    riskFlags.push("invalid_transition");
  }

  canonChecks.push("rule-character-knowledge-boundary", "rule-timeline-consistency");

  return {
    nextState,
    candidateBranches,
    riskFlags,
    canonChecks
  };
}
