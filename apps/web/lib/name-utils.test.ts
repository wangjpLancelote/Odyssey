import { describe, expect, test } from "bun:test";
import { normalizeDisplayName, validateDisplayName } from "./name-utils";

describe("display name utils", () => {
  test("normalizes full-width and spaces", () => {
    expect(normalizeDisplayName(" ＡＢ_12 ")).toBe("ab_12");
  });

  test("rejects invalid symbols", () => {
    expect(validateDisplayName("name!!")).toBeTruthy();
  });

  test("accepts valid name", () => {
    expect(validateDisplayName("路明非_07")).toBeNull();
  });
});
