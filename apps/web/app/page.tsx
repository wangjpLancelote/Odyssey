import Link from "next/link";

const MENU_ENTRIES = [
  { href: "/new-story", label: "新的故事", emoji: "⚔️", rune: "骑士试炼" },
  { href: "/memories", label: "旧的回忆", emoji: "🛡️", rune: "封印档案" },
  { href: "/changelog", label: "更新日志", emoji: "📜", rune: "军团战报" },
  { href: "/version", label: "版本信息", emoji: "👑", rune: "王国纪元" }
] as const;

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="relative h-screen overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(122,176,224,0.42)_0%,rgba(101,156,205,0.22)_38%,rgba(57,97,140,0.44)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_6%,rgba(226,241,255,0.6)_0%,rgba(157,199,234,0.22)_36%,transparent_68%)]" />

      {/* Main content row: hero left, menu right, top-aligned */}
      <div className="z-10 relative flex md:flex-row flex-col h-full">
        {/* Hero area: centered within the remaining left space */}
        <div className="flex flex-col flex-1 justify-center items-center px-4 h-full overflow-hidden">
          <div className="flex flex-col items-center">
            <div
              className="bg-contain bg-no-repeat bg-center drop-shadow-[0_16px_30px_rgba(9,13,20,0.35)] w-[min(800px,70vw)] h-[42vh]"
              style={{ backgroundImage: "url('/assets/ui/home-voyage-sailship.svg')" }}
            />
            <div className="mt-2 text-center">
              <h1 className="m-0 [font-family:var(--font-title)] font-medium text-[#f3ead2] text-[clamp(54px,9vw,96px)] tracking-[0.22em] [text-shadow:0_10px_28px_rgba(0,0,0,0.5),0_0_20px_rgba(226,194,134,0.28),0_0_60px_rgba(212,182,127,0.15)] [transform:scaleY(1.18)]">
                Odyssey
              </h1>
              <div className="relative mx-auto mt-3 max-w-[620px]">
                <p className="text-[#eef3ff] text-base [text-shadow:0_2px_8px_rgba(5,10,20,0.35)] blur-[0.4px]">
                  海风会吹散犹豫，真正的冒险只会向前。
                </p>
                <p aria-hidden className="pointer-events-none absolute left-0 right-0 top-full mt-0.5 text-base text-[#eef3ff] opacity-[0.12] blur-[1.5px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.5),transparent_80%)] [transform:scaleY(-0.4)]">
                  海风会吹散犹豫，真正的冒险只会向前。
                </p>
              </div>
              {params.reason === "session_required" ? (
                <p className="bg-[#22395666] mx-auto mt-4 px-4 py-2 border border-[#d9b87866] rounded-xl max-w-[620px] text-[#ffe8bf] text-sm text-left">
                  你还没有完成命名开局，请先进入"新的故事"或"旧的回忆"。
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right-side menu, top-aligned with hero */}
        <aside className="flex flex-col justify-start items-center md:items-end px-4 py-8 md:pr-6 w-full md:w-[min(400px,32vw)] shrink-0 h-full overflow-y-auto">
        <div className="relative w-full max-w-[380px]">
          <div className="hidden md:block -top-14 left-7 absolute bg-[linear-gradient(180deg,rgba(122,82,48,0.96)_0%,rgba(79,52,30,0.98)_100%)] shadow-[inset_0_1px_0_rgba(252,219,170,0.24),0_6px_16px_rgba(16,10,5,0.42)] border border-[#bc8e5975] rounded-lg w-3 h-16 pointer-events-none" />
          <div className="hidden md:block -top-14 right-7 absolute bg-[linear-gradient(180deg,rgba(122,82,48,0.96)_0%,rgba(79,52,30,0.98)_100%)] shadow-[inset_0_1px_0_rgba(252,219,170,0.24),0_6px_16px_rgba(16,10,5,0.42)] border border-[#bc8e5975] rounded-lg w-3 h-16 pointer-events-none" />
          <div className="bg-[linear-gradient(180deg,rgba(34,43,56,0.82),rgba(19,25,34,0.84))] shadow-[inset_0_1px_0_rgba(236,210,164,0.2),0_18px_34px_rgba(8,8,12,0.4)] backdrop-blur-sm p-5 border border-[#cba67052] rounded-2xl">
            <nav className="flex flex-col gap-10">
              {MENU_ENTRIES.map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className="group relative flex flex-col justify-center items-center bg-[linear-gradient(180deg,rgba(95,110,130,0.95)_0%,rgba(58,72,92,0.95)_56%,rgba(42,54,72,0.96)_100%)] shadow-[0_12px_24px_rgba(4,7,12,0.44),inset_0_1px_0_rgba(255,240,210,0.26),inset_0_-2px_8px_rgba(9,14,20,0.52)] hover:shadow-[0_14px_30px_rgba(0,0,0,0.38),0_0_20px_rgba(222,190,132,0.3),inset_0_1px_0_rgba(255,241,209,0.34)] px-5 py-3 border-[#d5b078cf] border-2 hover:border-[#e7c58bf5] rounded-xl w-full min-h-[96px] overflow-hidden text-center no-underline transition hover:-translate-y-1 duration-200 ease-out"
                >
                  <span className="top-2 right-4 absolute text-[#f5e2bccc] text-base pointer-events-none [text-shadow:0_2px_4px_rgba(5,8,12,0.45)]">
                    ⚜
                  </span>
                  <span className="inline-flex items-center gap-3 font-bold text-[#f1f4ff] text-[clamp(20px,2.6vw,26px)] tracking-[0.06em] [text-shadow:0_2px_12px_rgba(8,14,26,0.6),0_0_10px_rgba(206,173,116,0.2)]">
                    <span className="drop-shadow-[0_2px_4px_rgba(8,12,18,0.45)] text-xl">{entry.emoji}</span>
                    {entry.label}
                  </span>
                  <span className="mt-1 text-[#e4c999f2] text-xs uppercase tracking-[0.16em] [text-shadow:0_1px_3px_rgba(9,10,14,0.5)]">
                    {entry.rune}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </aside>
      </div>
    </main>
  );
}
