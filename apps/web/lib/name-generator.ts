const LAST_NAMES = [
  "路",
  "楚",
  "陈",
  "苏",
  "夏",
  "白",
  "林",
  "夜",
  "零",
  "诺"
];

const GIVEN_NAMES = [
  "明非",
  "子航",
  "恺撒",
  "绘梨",
  "星野",
  "千夏",
  "凛",
  "烬",
  "岚",
  "璃"
];

const SUFFIXES = ["", "_A", "_B", "_X", "_07", "_13"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function generateRandomDisplayName(): string {
  return `${pick(LAST_NAMES)}${pick(GIVEN_NAMES)}${pick(SUFFIXES)}`;
}

export function generateDisplayNameSuggestions(count: number): string[] {
  const uniq = new Set<string>();
  const target = Math.max(1, Math.min(20, count));

  while (uniq.size < target) {
    uniq.add(generateRandomDisplayName());
  }

  return [...uniq];
}
