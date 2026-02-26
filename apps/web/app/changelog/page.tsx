import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

function resolveWorkspaceRoot(): string {
  const current = process.cwd();
  return current.endsWith("/apps/web") ? path.resolve(current, "../..") : current;
}

export default async function ChangelogPage() {
  const root = resolveWorkspaceRoot();
  const changelogPath = path.resolve(root, "changelog.md");

  let content = "未找到 changelog.md";
  try {
    content = await readFile(changelogPath, "utf8");
  } catch {
    // keep fallback text
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-[820px] rounded-xl border border-[var(--ody-border)] bg-[var(--ody-surface-card)] p-6 shadow-[var(--ody-shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="m-0 text-3xl tracking-[0.06em] text-[var(--ody-gold-200)]">更新日志</h1>
          <Link href="/" className="text-[var(--ody-gold-200)] underline underline-offset-4">
            返回首页
          </Link>
        </div>
        <pre className="mt-4 max-h-[68vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--ody-border-subtle)] bg-[rgba(14,18,26,0.72)] p-4 text-xs leading-6 text-[#d9e0ef] [font-family:var(--ody-font-mono)]">
          {content}
        </pre>
      </section>
    </main>
  );
}
