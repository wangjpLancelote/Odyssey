import { describe, expect, test } from "bun:test";
import { addCheckpoint, createFootprintMap, restoreCheckpoint, runSideQuestStateMachine } from "./index";

describe("footprint checkpoint", () => {
  test("restores by checkpoint id", () => {
    const map = addCheckpoint(createFootprintMap("s1", "p1"), "node-1", "cursor-1");
    const checkpoint = restoreCheckpoint(map, "cp-s1-1");

    expect(checkpoint?.nodeId).toBe("node-1");
  });
});

describe("sidequest machine", () => {
  test("generates candidate when eligible", () => {
    const output = runSideQuestStateMachine(
      {
        sessionId: "s1",
        playerId: "p1",
        chapterId: "chapter-cassell-intro",
        nodeId: "node-campus-gate",
        rank: "B",
        bloodline: {
          purity: 45,
          stability: 70,
          corruption: 6
        },
        prohibitedCanonRules: []
      },
      "IDLE"
    );

    expect(output.nextState).toBe("ACTIVE");
    expect(output.candidateBranches.length).toBe(1);
  });
});
