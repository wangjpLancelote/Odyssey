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
    <main className="entry-page">
      <section className="entry-shell card">
        <div className="row">
          <h1 className="m-0 text-3xl tracking-[0.06em] text-[var(--ody-gold-200)]">纪元档案 👑</h1>
          <Link href="/" className="menu-inline-link">
            返回首页
          </Link>
        </div>

        <p className="small mt-2">记录你脚下这段旅程所使用的客户端版本与构建来源。</p>

        <div className="mt-5 rounded-xl border border-[var(--ody-border-subtle)] bg-[rgba(15,20,28,0.66)] p-5">
          <p className="small m-0">当前远征版本</p>
          <div className="version-pill">{version}</div>
          <p className="small mt-3">来源：`apps/web/package.json`</p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="small">想查看版本变更细节？</span>
          <Link href="/changelog" className="menu-inline-link">
            前往更新日志
          </Link>
        </div>
      </section>
    </main>
  );
}
