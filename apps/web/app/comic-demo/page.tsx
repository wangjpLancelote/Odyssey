"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompiledComicSequence } from "@odyssey/shared";
import { ComicStageKonva } from "@/components/comic-stage-konva";
import { DragonButton } from "@/components/ui-dragon";
import { Message } from "@/components/ui-message";
import { clearInkRasterCache } from "@/lib/comic-render/ink-raster-cache";

type ComicSource = "chapter_intro" | "dialogue_node";
type DayNight = "DAY" | "NIGHT";

type ChapterOption = {
  id: string;
  title: string;
  nodeCount: number;
  actCount: number;
};

const CHAPTERS: ChapterOption[] = Array.from({ length: 12 }, (_, idx) => {
  const order = idx + 1;
  const id = `ch${String(order).padStart(2, "0")}`;
  const nodeCount = order <= 2 || order === 12 ? 4 : 5;
  const actCount = order === 12 ? 4 : 3;
  return {
    id,
    title: `第${order}幕`,
    nodeCount,
    actCount
  };
});

function chapterNodeIds(chapterId: string): string[] {
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0]!;
  return Array.from({ length: chapter.nodeCount }, (_, index) => `fd-${chapter.id}-node-${String(index + 1).padStart(2, "0")}`);
}

function chapterActIds(chapterId: string): string[] {
  const chapter = CHAPTERS.find((item) => item.id === chapterId) ?? CHAPTERS[0]!;
  return Array.from({ length: chapter.actCount }, (_, index) => `act-${String(index + 1).padStart(2, "0")}`);
}

export default function ComicDemoPage() {
  const [chapterId, setChapterId] = useState("ch01");
  const [source, setSource] = useState<ComicSource>("chapter_intro");
  const [nodeId, setNodeId] = useState("fd-ch01-node-01");
  const [actId, setActId] = useState("act-01");
  const [dayNight, setDayNight] = useState<DayNight>("DAY");
  const [branchTag, setBranchTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sequence, setSequence] = useState<CompiledComicSequence | null>(null);

  const nodeOptions = useMemo(() => chapterNodeIds(chapterId), [chapterId]);
  const actOptions = useMemo(() => chapterActIds(chapterId), [chapterId]);

  useEffect(() => {
    const nextNode = nodeOptions[0] ?? "";
    setNodeId(nextNode);
    setActId(actOptions[0] ?? "act-01");
  }, [nodeOptions, actOptions]);

  const fetchSequence = async (clearCache = false) => {
    if (clearCache) {
      clearInkRasterCache();
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comic/demo/sequence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        cache: "no-store",
        body: JSON.stringify({
          storylineId: "fire-dawn",
          chapterId,
          source,
          nodeId: source === "dialogue_node" ? nodeId : undefined,
          actId,
          style: "hero_bright",
          dayNight,
          branchTag: branchTag || undefined
        })
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `demo_request_failed_${res.status}`);
      }

      const payload = (await res.json()) as CompiledComicSequence;
      setSequence(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      setError(`分镜预览加载失败：${message}`);
      setSequence(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSequence(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportPng = () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".comic-stage-fabric-canvas");
    if (!canvas) {
      setError("当前没有可导出的分镜画布。");
      return;
    }
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `comic-demo-${chapterId}-${actId}-${source}.png`;
    link.click();
  };

  return (
    <main className="comic-demo-page">
      <div className="shell">
        <section className="card">
          <h1 style={{ marginTop: 0 }}>分镜 Demo：黑白水墨预览</h1>
          <p className="small">仅开发环境可用。用于按 chapter/act/source 快速调试分镜风格与交互。</p>

          <div className="row" style={{ flexWrap: "wrap", gap: "var(--ody-space-md)", marginTop: "var(--ody-space-md)" }}>
            <label className="small">
              Chapter
              <select value={chapterId} onChange={(e) => setChapterId(e.target.value)} style={{ display: "block", marginTop: 6 }}>
                {CHAPTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.id} / {item.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="small">
              Source
              <select value={source} onChange={(e) => setSource(e.target.value as ComicSource)} style={{ display: "block", marginTop: 6 }}>
                <option value="chapter_intro">chapter_intro</option>
                <option value="dialogue_node">dialogue_node</option>
              </select>
            </label>

            <label className="small">
              Node
              <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} style={{ display: "block", marginTop: 6 }}>
                {nodeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="small">
              Act
              <select value={actId} onChange={(e) => setActId(e.target.value)} style={{ display: "block", marginTop: 6 }}>
                {actOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="small">
              Day/Night
              <select value={dayNight} onChange={(e) => setDayNight(e.target.value as DayNight)} style={{ display: "block", marginTop: 6 }}>
                <option value="DAY">DAY</option>
                <option value="NIGHT">NIGHT</option>
              </select>
            </label>

            <label className="small">
              BranchTag
              <input
                value={branchTag}
                onChange={(e) => setBranchTag(e.target.value)}
                placeholder="可选"
                style={{ display: "block", marginTop: 6 }}
              />
            </label>
          </div>

          <div className="row" style={{ marginTop: "var(--ody-space-md)", gap: "var(--ody-space-sm)", flexWrap: "wrap" }}>
            <DragonButton onClick={() => void fetchSequence(false)} disabled={loading}>
              {loading ? "渲染中..." : "渲染预览"}
            </DragonButton>
            <DragonButton variant="secondary" onClick={() => void fetchSequence(true)} disabled={loading}>
              清缓存重渲
            </DragonButton>
            <DragonButton variant="outline" onClick={exportPng} disabled={!sequence}>
              导出PNG
            </DragonButton>
          </div>

          {error ? (
            <Message tone="warning" className="mt-3">
              {error}
            </Message>
          ) : null}
        </section>

        <section className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>预览舞台</h2>
            <span className="small">
              {sequence ? `${sequence.storylineId}/${sequence.chapterId}/${sequence.nodeId ?? "intro"}` : "尚未生成"}
            </span>
          </div>
          <ComicStageKonva sequence={sequence} visualMode="monochrome" />
        </section>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>编译信息</h3>
          <div className="small">sourceHash：{sequence?.meta.sourceHash ?? "-"}</div>
          <div className="small">warnings：{sequence?.meta.warnings.join(" | ") || "-"}</div>
          <pre style={{ marginTop: "var(--ody-space-md)", overflow: "auto", maxHeight: 360 }}>
            {JSON.stringify(sequence, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  );
}
