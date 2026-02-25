export const DISPLAY_NAME_PATTERN = /^[\u4E00-\u9FFFA-Za-z0-9_]+$/u;

export function normalizeDisplayName(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function sanitizeDisplayName(value: string): string {
  return value.normalize("NFKC").trim();
}

export function validateDisplayName(value: string): string | null {
  const normalized = sanitizeDisplayName(value);

  if (normalized.length < 2 || normalized.length > 12) {
    return "名字长度需要在 2 到 12 个字符之间";
  }

  if (!DISPLAY_NAME_PATTERN.test(normalized)) {
    return "名字仅支持中文、字母、数字和下划线";
  }

  return null;
}
