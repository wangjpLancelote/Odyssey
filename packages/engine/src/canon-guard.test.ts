import { describe, expect, test } from "bun:test";
import { validateCanon } from "./canon-guard";

describe("canon guard", () => {
  test("blocks high tier cast for low rank", () => {
    const violations = validateCanon({
      rank: "D",
      bloodline: {
        purity: 22,
        stability: 20,
        corruption: 10
      },
      releasedSpirits: [
        {
          code: "A-01",
          title: "君焰",
          tier: 6,
          cooldownMs: 10000,
          cost: 18
        }
      ],
      candidate: {
        questId: "sq-1",
        title: "雨夜试炼",
        hook: "路明非在档案室遇到异常的龙文残卷。",
        startNodeId: "node-1",
        resolution: "完成调查",
        riskFlags: []
      },
      canonicalCharacters: ["路明非", "诺诺"]
    });

    expect(violations.some((v) => v.ruleId === "rule-word-spirit-tier-lock")).toBe(true);
  });
});
