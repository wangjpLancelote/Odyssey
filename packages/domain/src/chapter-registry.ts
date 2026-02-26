import { chapterTimelineSchema, type ChapterTimeline, type ChapterTimelineItem } from "@odyssey/shared";

export class ChapterTimelineError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ChapterRegistry {
  readonly timeline: ChapterTimeline;
  private readonly chapterMap: Map<string, ChapterTimelineItem>;

  constructor(timeline: ChapterTimeline) {
    this.timeline = chapterTimelineSchema.parse(timeline);
    this.chapterMap = new Map(this.timeline.chapters.map((chapter) => [chapter.id, chapter]));
    this.validateTimeline();
  }

  getChapter(chapterId: string): ChapterTimelineItem {
    const chapter = this.chapterMap.get(chapterId);
    if (!chapter) {
      throw new ChapterTimelineError(`chapter_not_found:${chapterId}`);
    }
    return chapter;
  }

  getNextChapter(currentChapterId: string): ChapterTimelineItem | null {
    const current = this.getChapter(currentChapterId);
    if (!current.nextId) return null;
    return this.getChapter(current.nextId);
  }

  canStartAt(chapterId: string): boolean {
    const chapter = this.getChapter(chapterId);
    return chapter.enabled;
  }

  canEnterNext(fromChapterId: string, toChapterId: string): boolean {
    const from = this.getChapter(fromChapterId);
    return from.nextId === toChapterId;
  }

  private validateTimeline(): void {
    const sorted = [...this.timeline.chapters].sort((a, b) => a.order - b.order);
    const seen = new Set<number>();

    for (let idx = 0; idx < sorted.length; idx += 1) {
      const chapter = sorted[idx];

      if (seen.has(chapter.order)) {
        throw new ChapterTimelineError(`duplicate_order:${chapter.order}`);
      }
      seen.add(chapter.order);

      if (chapter.order !== idx + 1) {
        throw new ChapterTimelineError(`order_not_contiguous:${chapter.id}`);
      }

      const prev = sorted[idx - 1] ?? null;
      const next = sorted[idx + 1] ?? null;

      if ((prev?.id ?? null) !== chapter.prevId) {
        throw new ChapterTimelineError(`prev_mismatch:${chapter.id}`);
      }

      if ((next?.id ?? null) !== chapter.nextId) {
        throw new ChapterTimelineError(`next_mismatch:${chapter.id}`);
      }
    }

    for (const chapter of sorted) {
      let slow: string | null = chapter.id;
      let fast: string | null = chapter.id;

      while (fast) {
        const fastNode = this.getChapter(fast);
        fast = fastNode.nextId;

        if (!fast) break;
        const fastNode2 = this.getChapter(fast);
        fast = fastNode2.nextId;

        if (!slow) break;
        const slowNode = this.getChapter(slow);
        slow = slowNode.nextId;

        if (slow && fast && slow === fast) {
          throw new ChapterTimelineError(`cycle_detected:${chapter.id}`);
        }
      }
    }
  }
}
