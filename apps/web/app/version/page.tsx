import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

function resolveWebPackagePath(): string {
  const current = process.cwd();
  if (current.endsWith("/apps/web")) {
    return path.resolve(current, "package.json");
  }
  return path.resolve(current, "apps/web/package.json");
}

export default async function VersionPage() {
  const packagePath = resolveWebPackagePath();

  let version = "unknown";
  try {
    const raw = await readFile(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    version = parsed.version ?? "unknown";
  } catch {
    // keep fallback
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-[760px] rounded-xl border border-[var(--ody-border)] bg-[var(--ody-surface-card)] p-6 text-center shadow-[var(--ody-shadow-card)]">
        <div className="flex items-center justify-between gap-3 text-left">
          <h1 className="m-0 text-3xl tracking-[0.06em] text-[var(--ody-gold-200)]">版本信息</h1>
          <Link href="/" className="text-[var(--ody-gold-200)] underline underline-offset-4">
            返回首页
          </Link>
        </div>
        <p className="mt-6 text-sm text-[var(--ody-text-muted)]">当前 Web 应用版本：</p>
        <div className="mx-auto mt-2 inline-flex rounded-full border border-[var(--ody-border-strong)] bg-[rgba(212,182,127,0.14)] px-5 py-2 text-lg [font-family:var(--ody-font-mono)]">
          {version}
        </div>
      </section>
    </main>
  );
}
