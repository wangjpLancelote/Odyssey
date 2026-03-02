"use client";

import { useEffect, useMemo } from "react";
import type { FootprintMap } from "@odyssey/shared";
import { DragonButton } from "@/components/ui-dragon";
import { Message } from "@/components/ui-message";

type ChapterTreeNode = {
  chapterId: string;
  nodeGroups: Array<{
    nodeId: string;
    checkpoints: FootprintMap["checkpoints"];
  }>;
  totalCheckpoints: number;
};

type FootprintDrawerProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  footprint: FootprintMap | null;
  currentChapterId?: string;
  currentNodeId?: string;
  onClose: () => void;
  onRefresh: () => void;
  onRestore: (checkpointId: string) => void;
};

type OverflowTextProps = {
  text: string;
  className?: string;
  maxChars?: number;
};

function formatCheckpointTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

function stringifyMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function OverflowText({ text, className, maxChars = 36 }: OverflowTextProps) {
  const normalized = text.trim();
  const isLong = normalized.length > maxChars;
  const display = isLong ? `${normalized.slice(0, Math.max(1, maxChars - 1))}…` : normalized;
  return (
    <span
      className={["footprint-ellipsis", isLong ? "has-tooltip" : "", className].filter(Boolean).join(" ")}
      title={isLong ? normalized : undefined}
    >
      {display || "-"}
    </span>
  );
}

export function FootprintDrawer({
  open,
  loading,
  error,
  footprint,
  currentChapterId,
  currentNodeId,
  onClose,
  onRefresh,
  onRestore
}: FootprintDrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const chapterTree = useMemo<ChapterTreeNode[]>(() => {
    if (!footprint) return [];

    const chapterMap = new Map<
      string,
      {
        chapterId: string;
        nodeGroups: Map<string, FootprintMap["checkpoints"]>;
        totalCheckpoints: number;
      }
    >();

    for (const checkpoint of footprint.checkpoints) {
      let chapterNode = chapterMap.get(checkpoint.chapterId);
      if (!chapterNode) {
        chapterNode = {
          chapterId: checkpoint.chapterId,
          nodeGroups: new Map<string, FootprintMap["checkpoints"]>(),
          totalCheckpoints: 0
        };
        chapterMap.set(checkpoint.chapterId, chapterNode);
      }

      const nodeGroup = chapterNode.nodeGroups.get(checkpoint.nodeId) ?? [];
      nodeGroup.push(checkpoint);
      chapterNode.nodeGroups.set(checkpoint.nodeId, nodeGroup);
      chapterNode.totalCheckpoints += 1;
    }

    return Array.from(chapterMap.values()).map((chapterNode) => ({
      chapterId: chapterNode.chapterId,
      totalCheckpoints: chapterNode.totalCheckpoints,
      nodeGroups: Array.from(chapterNode.nodeGroups.entries()).map(([nodeId, checkpoints]) => ({
        nodeId,
        checkpoints
      }))
    }));
  }, [footprint]);

  const activeCheckpointId = useMemo(() => {
    if (!footprint || !currentChapterId || !currentNodeId) return null;
    const candidates = footprint.checkpoints.filter(
      (checkpoint) => checkpoint.chapterId === currentChapterId && checkpoint.nodeId === currentNodeId
    );
    return candidates.length ? candidates[candidates.length - 1]?.checkpointId ?? null : null;
  }, [footprint, currentChapterId, currentNodeId]);

  return (
    <div className={`footprint-drawer-shell ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="footprint-drawer-backdrop" type="button" aria-label="关闭足迹面板" onClick={onClose} />
      <aside className="footprint-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="footprint-drawer-title">
        <div className="footprint-drawer-header">
          <h3 id="footprint-drawer-title" style={{ margin: 0 }}>
            足迹树状图
          </h3>
          <div className="row" style={{ gap: "var(--ody-space-sm)" }}>
            <DragonButton variant="secondary" onClick={onRefresh} disabled={loading}>
              刷新
            </DragonButton>
            <DragonButton variant="ghost" onClick={onClose}>
              关闭
            </DragonButton>
          </div>
        </div>

        <div className="footprint-drawer-content">
          {loading ? <div className="small">正在追溯足迹...</div> : null}
          {error ? (
            <Message tone="warning" className="mt-3">
              {error}
            </Message>
          ) : null}

          {!loading && !error && !footprint ? <div className="small">还没有读取到足迹数据。</div> : null}

          {!loading && !error && footprint && footprint.checkpoints.length === 0 ? (
            <div className="small">当前尚无足迹锚点。</div>
          ) : null}

          {!loading && !error && footprint && footprint.checkpoints.length > 0 ? (
            <div className="footprint-tree-root">
              <div className="footprint-tree-head small">
                <div className="footprint-tree-meta-row">
                  <span className="footprint-tree-meta-label">主线</span>
                  <OverflowText text={footprint.checkpoints[0]?.storylineId ?? "-"} maxChars={48} />
                </div>
                <div className="footprint-tree-meta-row">
                  <span className="footprint-tree-meta-label">旅者</span>
                  <OverflowText text={footprint.playerId} maxChars={48} />
                </div>
                <div className="footprint-tree-meta-row">
                  <span className="footprint-tree-meta-label">锚点</span>
                  <span className="footprint-tree-meta-more">{footprint.checkpoints.length}</span>
                </div>
              </div>
              <ul className="footprint-tree-list">
                {chapterTree.map((chapter) => (
                  <li key={chapter.chapterId}>
                    <div className="footprint-tree-item is-chapter">
                      <span className="footprint-tree-dot" aria-hidden />
                      <strong>{chapter.chapterId}</strong>
                      <span className="small">({chapter.totalCheckpoints} 个锚点)</span>
                    </div>
                    <ul className="footprint-tree-list">
                      {chapter.nodeGroups.map((nodeGroup) => (
                        <li key={`${chapter.chapterId}:${nodeGroup.nodeId}`}>
                          <div className="footprint-tree-item is-node">
                            <span className="footprint-tree-dot" aria-hidden />
                            节点 {nodeGroup.nodeId}
                          </div>
                          <ul className="footprint-tree-list">
                            {nodeGroup.checkpoints.map((checkpoint) => {
                              const metadataEntries = Object.entries(checkpoint.metadata ?? {}).slice(0, 3);
                              const isCurrent = checkpoint.checkpointId === activeCheckpointId;
                              return (
                                <li key={checkpoint.checkpointId} className={`footprint-tree-leaf ${isCurrent ? "is-current" : ""}`}>
                                  <div className="footprint-tree-item is-checkpoint footprint-tree-summary-line">
                                    <span className="footprint-tree-dot" aria-hidden />
                                    <strong className="footprint-tree-inline-value">
                                      <OverflowText text={checkpoint.checkpointId} maxChars={48} />
                                    </strong>
                                  </div>
                                  <div className="small footprint-tree-meta-grid">
                                    <div className="footprint-tree-meta-row">
                                      <span className="footprint-tree-meta-label">时间</span>
                                      <OverflowText text={formatCheckpointTime(checkpoint.createdAt)} maxChars={40} />
                                    </div>
                                    <div className="footprint-tree-meta-row">
                                      <span className="footprint-tree-meta-label">游标</span>
                                      <OverflowText text={checkpoint.plotCursor} maxChars={40} />
                                    </div>
                                    {metadataEntries.map(([key, value]) => (
                                      <div className="footprint-tree-meta-row" key={`${checkpoint.checkpointId}:${key}`}>
                                        <span className="footprint-tree-meta-label">{key}</span>
                                        <OverflowText text={stringifyMetadataValue(value)} maxChars={54} />
                                      </div>
                                    ))}
                                    {Object.keys(checkpoint.metadata ?? {}).length > metadataEntries.length ? (
                                      <div className="footprint-tree-meta-row">
                                        <span className="footprint-tree-meta-label">更多</span>
                                        <span className="footprint-tree-meta-more">
                                          +{Object.keys(checkpoint.metadata ?? {}).length - metadataEntries.length} 项
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                  <DragonButton
                                    variant="outline"
                                    onClick={() => {
                                      onRestore(checkpoint.checkpointId);
                                    }}
                                  >
                                    回溯到此
                                  </DragonButton>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
