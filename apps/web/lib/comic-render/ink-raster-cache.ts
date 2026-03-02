import type { ComicPanel, CompiledComicSequence } from "@odyssey/shared";

export type InkSizeBucket = 480 | 768 | 1024 | 1440;

export type InkRenderTheme = {
  themeId: string;
  dayNight: "DAY" | "NIGHT";
  paperColor: string;
  inkColor: string;
  accentColor: string;
};

export type InkRenderRequest = {
  panel: ComicPanel;
  sequence: CompiledComicSequence;
  width: number;
  height: number;
  theme: InkRenderTheme;
};

function inferBucket(width: number): InkSizeBucket {
  if (width <= 480) return 480;
  if (width <= 768) return 768;
  if (width <= 1024) return 1024;
  return 1440;
}

type CacheFactory = () => Promise<HTMLCanvasElement>;

export class InkRasterCache {
  private readonly cache = new Map<string, Promise<HTMLCanvasElement>>();

  keyFor(input: InkRenderRequest): string {
    const bucket = inferBucket(input.width);
    return [
      input.panel.panelId,
      input.theme.themeId,
      input.theme.dayNight,
      bucket,
      input.sequence.meta.sourceHash
    ].join(":");
  }

  async getOrCreate(key: string, factory: CacheFactory): Promise<HTMLCanvasElement> {
    const existing = this.cache.get(key);
    if (existing) {
      return existing;
    }

    const created = factory().catch((error) => {
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, created);
    return created;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const inkRasterCache = new InkRasterCache();

export function clearInkRasterCache(): void {
  inkRasterCache.clear();
}
