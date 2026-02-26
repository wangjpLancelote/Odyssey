import { afterEach, describe, expect, test } from "bun:test";
import { resolveAssetRef, resolveAssetUrl } from "./asset-resolver";

const PREV_MODE = process.env.ASSET_MODE;
const PREV_PUBLIC_MODE = process.env.NEXT_PUBLIC_ASSET_MODE;
const PREV_R2 = process.env.R2_PUBLIC_BASE_URL;
const PREV_PUBLIC_R2 = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL;

afterEach(() => {
  process.env.ASSET_MODE = PREV_MODE;
  process.env.NEXT_PUBLIC_ASSET_MODE = PREV_PUBLIC_MODE;
  process.env.R2_PUBLIC_BASE_URL = PREV_R2;
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL = PREV_PUBLIC_R2;
});

describe("asset-resolver", () => {
  test("maps legacy audio paths to /assets", () => {
    process.env.ASSET_MODE = "local";

    const url = resolveAssetUrl({
      kind: "audio",
      assetPath: "/audio/fire-dawn/ch01/bgm-morning.mp3"
    });

    expect(url).toBe("/assets/fire-dawn/ch01/audio/bgm/bgm-morning.mp3");
  });

  test("resolves chapter relative asset paths", () => {
    process.env.ASSET_MODE = "local";

    const url = resolveAssetUrl({
      kind: "video",
      assetPath: "video/cutscene/fire-dawn-ch01-open.mp4",
      storylineId: "fire-dawn",
      chapterId: "ch01"
    });

    expect(url).toBe("/assets/fire-dawn/ch01/video/cutscene/fire-dawn-ch01-open.mp4");
  });

  test("maps legacy image paths to /assets", () => {
    process.env.ASSET_MODE = "local";

    const url = resolveAssetUrl({
      kind: "image",
      assetPath: "/images/fire-dawn/ch02/bg-corridor.png"
    });

    expect(url).toBe("/assets/fire-dawn/ch02/image/bg-corridor.png");
  });

  test("switches to r2 url when configured", () => {
    process.env.ASSET_MODE = "r2";
    process.env.R2_PUBLIC_BASE_URL = "https://cdn.example.com/odyssey";

    const resolved = resolveAssetRef({
      id: "bgm-morning",
      kind: "audio",
      assetPath: "audio/bgm/bgm-morning.mp3",
      baseKey: "fire-dawn/ch01"
    });

    expect(resolved.source).toBe("r2");
    expect(resolved.url).toBe("https://cdn.example.com/odyssey/assets/fire-dawn/ch01/audio/bgm/bgm-morning.mp3");
  });
});
