import { describe, expect, test } from "bun:test";
import { detectDayNightBySystemTime } from "./day-night";

describe("day night detector", () => {
  test("returns DAY at noon", () => {
    expect(detectDayNightBySystemTime(new Date("2026-02-25T12:00:00"))).toBe("DAY");
  });

  test("returns NIGHT at midnight", () => {
    expect(detectDayNightBySystemTime(new Date("2026-02-25T00:30:00"))).toBe("NIGHT");
  });
});
