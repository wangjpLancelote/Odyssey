import { canCastWordSpirit } from "@odyssey/domain";
import type { BloodlineState, Rank, SideQuestCandidate, WordSpirit } from "@odyssey/shared";

export type CanonViolation = {
  ruleId: string;
  message: string;
};

export type CanonValidationInput = {
  rank: Rank;
  bloodline: BloodlineState;
  releasedSpirits: WordSpirit[];
  candidate: SideQuestCandidate;
  canonicalCharacters: string[];
};

export function validateCanon(input: CanonValidationInput): CanonViolation[] {
  const violations: CanonViolation[] = [];

  for (const spirit of input.releasedSpirits) {
    if (!canCastWordSpirit(input.rank, input.bloodline, spirit)) {
      violations.push({
        ruleId: "rule-word-spirit-tier-lock",
        message: `Rank ${input.rank} cannot cast ${spirit.title} tier ${spirit.tier}`
      });
    }
  }

  if (input.bloodline.purity > 100 || input.bloodline.purity < 0) {
    violations.push({
      ruleId: "rule-bloodline-cap",
      message: "Bloodline purity out of allowed range"
    });
  }

  const disallowedLeak = input.candidate.hook.includes("黑王真名");
  if (disallowedLeak) {
    violations.push({
      ruleId: "rule-character-knowledge-boundary",
      message: "Candidate reveals forbidden lore too early"
    });
  }

  const unknownCharacterMention = input.canonicalCharacters.every(
    (name) => !input.candidate.hook.includes(name)
  );
  if (unknownCharacterMention) {
    violations.push({
      ruleId: "rule-timeline-consistency",
      message: "No canonical anchor found in generated hook"
    });
  }

  return violations;
}
