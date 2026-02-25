export interface CacheStore<T> {
  get(key: string): T | null;
  set(key: string, value: T, ttlMs?: number): void;
  delete(key: string): void;
}

type Entry<T> = {
  value: T;
  expiresAt?: number;
};

export class InMemoryCacheStore<T> implements CacheStore<T> {
  private readonly map = new Map<string, Entry<T>>();

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    this.map.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined
    });
  }

  delete(key: string): void {
    this.map.delete(key);
  }
}
