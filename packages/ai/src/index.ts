import { runSideQuestStateMachine, validateCanon } from "@odyssey/engine";
import type {
  SideQuestMachineInput,
  SideQuestMachineOutput,
  SideQuestState,
  WordSpirit
} from "@odyssey/shared";

export type SideQuestGenerationResult = SideQuestMachineOutput & {
  model: string;
  blocked: boolean;
};

export type LlmAdapter = {
  model: string;
  generateText(prompt: string): Promise<string>;
};

export class MockLlmAdapter implements LlmAdapter {
  model = "mock-sidequest-v1";

  async generateText(prompt: string): Promise<string> {
    return `Generated branch draft for: ${prompt}`;
  }
}

export async function generateSideQuest(
  adapter: LlmAdapter,
  input: SideQuestMachineInput,
  currentState: SideQuestState,
  releasedSpirits: WordSpirit[]
): Promise<SideQuestGenerationResult> {
  const machine = runSideQuestStateMachine(input, currentState);

  if (machine.candidateBranches.length > 0) {
    const draft = await adapter.generateText(machine.candidateBranches[0].hook);
    machine.candidateBranches[0] = {
      ...machine.candidateBranches[0],
      hook: `${machine.candidateBranches[0].hook}\n${draft}`
    };
  }

  const violations = machine.candidateBranches.flatMap((candidate) =>
    validateCanon({
      rank: input.rank,
      bloodline: input.bloodline,
      releasedSpirits,
      candidate,
      canonicalCharacters: ["路明非", "诺诺", "楚子航", "古德里安"]
    })
  );

  return {
    ...machine,
    blocked: violations.length > 0,
    riskFlags: [...machine.riskFlags, ...violations.map((v) => v.ruleId)],
    model: adapter.model
  };
}
