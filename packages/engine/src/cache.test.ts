import { describe, expect, test } from "bun:test";
import { InMemoryCacheStore } from "./cache";

describe("cache store", () => {
  test("stores and expires value", async () => {
    const cache = new InMemoryCacheStore<string>();
    cache.set("k", "v", 5);
    expect(cache.get("k")).toBe("v");

    await new Promise((resolve) => setTimeout(resolve, 8));
    expect(cache.get("k")).toBeNull();
  });
});
