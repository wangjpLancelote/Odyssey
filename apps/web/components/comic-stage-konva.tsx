"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComicBubbleStyle, ComicBubbleTheme, ComicPanel, CompiledComicSequence } from "@odyssey/shared";
import { renderInkRaster } from "@/lib/comic-render/brush-primitives";
import { createFabricCameraController } from "@/lib/comic-render/fabric-camera-controller";
import { inkRasterCache, type InkRenderTheme } from "@/lib/comic-render/ink-raster-cache";

type Props = {
  sequence: CompiledComicSequence | null;
  focusPanelIndex?: number;
  onPanelSelect?: (index: number) => void;
  visualMode?: "default" | "monochrome";
};

type PanelFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PanelRenderItem = {
  panel: ComicPanel;
  frame: PanelFrame;
  listIndex: number;
  displayIndex: number;
};

type FabricCanvasLike = {
  add: (item: unknown) => void;
  clear: () => void;
  dispose: () => void;
  renderAll: () => void;
  requestRenderAll: () => void;
  setDimensions: (value: { width: number; height: number }) => void;
  on: (eventName: string, handler: (event?: unknown) => void) => void;
  off: (eventName: string, handler?: (event?: unknown) => void) => void;
  getZoom: () => number;
  setZoom: (value: number) => void;
  zoomToPoint: (point: { x: number; y: number }, value: number) => void;
  relativePan: (point: { x: number; y: number }) => void;
  setViewportTransform: (value: number[]) => void;
  getVpCenter: () => { x: number; y: number };
  getWidth: () => number;
  getHeight: () => number;
};

type FabricObjectLike = {
  set: (value: Record<string, unknown>) => void;
  on: (eventName: string, handler: (event?: unknown) => void) => void;
};

type FabricCtorModule = {
  Canvas?: new (...args: unknown[]) => FabricCanvasLike;
  Rect?: new (...args: unknown[]) => FabricObjectLike;
  Text?: new (...args: unknown[]) => FabricObjectLike;
  FabricImage?: new (...args: unknown[]) => FabricObjectLike;
  Image?: new (...args: unknown[]) => FabricObjectLike;
  Group?: new (...args: unknown[]) => FabricObjectLike;
  Path?: new (...args: unknown[]) => FabricObjectLike;
  Polygon?: new (...args: unknown[]) => FabricObjectLike;
};

const STAGE_MIN_WIDTH = 320;
const STAGE_MIN_HEIGHT = 460;
const STAGE_RATIO = 0.62;
const STAGE_ZOOM_MIN = 0.65;
const STAGE_ZOOM_MAX = 2.2;
const STAGE_BG_DEFAULT = "#efe8dc";
const STAGE_BG_MONOCHROME = "#050505";

const DEFAULT_BUBBLE_THEME: ComicBubbleTheme = {
  themeId: "ink-default",
  tone: "tense",
  defaultStyle: {
    fill: "#f3eee3",
    stroke: "#1c1917",
    strokeWidth: 2.5,
    shadow: 0.15,
    cornerBias: 0.52,
    tailCurve: 0.48
  },
  styleByBubbleType: {
    normal: {
      strokeWidth: 2.4,
      fill: "#f5efe5",
      stroke: "#221f1b"
    },
    shout: {
      fill: "#f1e7d5",
      stroke: "#0f0d0a",
      strokeWidth: 3.8,
      shadow: 0.24,
      cornerBias: 0.3,
      tailCurve: 0.28
    },
    whisper: {
      fill: "#f8f4eb",
      stroke: "#4f4b44",
      strokeWidth: 1.8,
      shadow: 0.1,
      cornerBias: 0.84,
      tailCurve: 0.8
    }
  },
  typography: {
    fontFamily: "Kaiti SC, STKaiti, KaiTi, serif",
    fontSize: 16,
    lineHeight: 1.4,
    letterSpacing: 0.2,
    textColor: "#1e1b18"
  },
  ornaments: {
    speedline: { enabled: true, intensity: 0.42 },
    halftone: { enabled: false, intensity: 0.1 },
    impactRays: { enabled: true, intensity: 0.36 }
  },
  constraints: {
    minFontSize: 12,
    maxLines: 4,
    minBubbleWidth: 140,
    maxBubbleWidth: 340
  }
};

const MONOCHROME_BUBBLE_THEME: ComicBubbleTheme = {
  themeId: "mono-demo",
  tone: "tense",
  defaultStyle: {
    fill: "#fdfdfd",
    stroke: "#111111",
    strokeWidth: 2.6,
    shadow: 0.1,
    cornerBias: 0.5,
    tailCurve: 0.42
  },
  styleByBubbleType: {
    normal: {
      fill: "#ffffff",
      stroke: "#111111",
      strokeWidth: 2.4
    },
    shout: {
      fill: "#ffffff",
      stroke: "#000000",
      strokeWidth: 3.8,
      shadow: 0.16,
      cornerBias: 0.3,
      tailCurve: 0.25
    },
    whisper: {
      fill: "#f2f2f2",
      stroke: "#1f1f1f",
      strokeWidth: 1.8,
      shadow: 0.08,
      cornerBias: 0.82,
      tailCurve: 0.76
    }
  },
  typography: {
    fontFamily: "Kaiti SC, STKaiti, KaiTi, serif",
    fontSize: 16,
    lineHeight: 1.4,
    letterSpacing: 0.15,
    textColor: "#0d0d0d"
  },
  ornaments: {
    speedline: { enabled: true, intensity: 0.5 },
    halftone: { enabled: false, intensity: 0.1 },
    impactRays: { enabled: true, intensity: 0.42 }
  },
  constraints: {
    minFontSize: 12,
    maxLines: 4,
    minBubbleWidth: 140,
    maxBubbleWidth: 340
  }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function panelFrame(panel: ComicPanel, width: number, height: number, focused: boolean): PanelFrame {
  if (focused) {
    return { x: 14, y: 14, w: width - 28, h: height - 28 };
  }

  return {
    x: panel.layout.x * width,
    y: panel.layout.y * height,
    w: panel.layout.w * width,
    h: panel.layout.h * height
  };
}

function resolveBubbleTheme(
  sequence: CompiledComicSequence | null,
  visualMode: "default" | "monochrome"
): ComicBubbleTheme {
  if (visualMode === "monochrome") {
    return MONOCHROME_BUBBLE_THEME;
  }
  return sequence?.meta.bubbleTheme ?? DEFAULT_BUBBLE_THEME;
}

function resolveInkTheme(
  sequence: CompiledComicSequence,
  panel: ComicPanel,
  visualMode: "default" | "monochrome"
): InkRenderTheme {
  if (visualMode === "monochrome") {
    return {
      themeId: sequence.meta.bubbleThemeId ?? `${sequence.style}-mono`,
      dayNight: "NIGHT",
      paperColor: "#050505",
      inkColor: "#f4f4f4",
      accentColor: "rgba(255,255,255,0.75)"
    };
  }

  const dayNight = (panel.paletteToken ?? "").toLowerCase().includes("night") ? "NIGHT" : "DAY";
  if (dayNight === "NIGHT") {
    return {
      themeId: sequence.meta.bubbleThemeId ?? `${sequence.style}-night`,
      dayNight,
      paperColor: "#d8d0c2",
      inkColor: "#161412",
      accentColor: "rgba(20,18,16,0.72)"
    };
  }

  return {
    themeId: sequence.meta.bubbleThemeId ?? `${sequence.style}-day`,
    dayNight,
    paperColor: "#efe6d8",
    inkColor: "#1a1714",
    accentColor: "rgba(33,30,25,0.65)"
  };
}

function seededRandom(seedText: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveBubbleStyle(theme: ComicBubbleTheme, style: ComicBubbleStyle): {
  fill: string;
  stroke: string;
  strokeWidth: number;
} {
  const patch = theme.styleByBubbleType[style] ?? {};
  return {
    fill: patch.fill ?? theme.defaultStyle.fill,
    stroke: patch.stroke ?? theme.defaultStyle.stroke,
    strokeWidth: patch.strokeWidth ?? theme.defaultStyle.strokeWidth
  };
}

function wrapText(text: string, maxLines: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";

  const maxCharsPerLine = 14;
  const words = compact.includes(" ") ? compact.split(" ") : compact.split("");
  const lines: string[] = [];
  let current = "";

  for (const token of words) {
    const candidate = current ? `${current}${compact.includes(" ") ? " " : ""}${token}` : token;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = token;
    } else {
      lines.push(token.slice(0, maxCharsPerLine));
      current = token.slice(maxCharsPerLine);
    }

    if (lines.length >= maxLines) {
      return `${lines.slice(0, maxLines).join("\n")}…`;
    }
  }

  if (current) lines.push(current);
  if (lines.length > maxLines) {
    return `${lines.slice(0, maxLines).join("\n")}…`;
  }
  return lines.join("\n");
}

function createHandDrawnBubblePath(bounds: {
  x: number;
  y: number;
  w: number;
  h: number;
  tailX: number;
  tailY: number;
  cornerBias: number;
  seed: string;
}): { path: string; tail: Array<{ x: number; y: number }> } {
  const rand = seededRandom(bounds.seed);
  const radius = clamp(8 + bounds.cornerBias * 18, 8, 28);
  const jitter = 2.8;

  const left = bounds.x;
  const top = bounds.y;
  const right = bounds.x + bounds.w;
  const bottom = bounds.y + bounds.h;

  const j = () => (rand() - 0.5) * jitter;

  const path = [
    `M ${left + radius + j()} ${top + j()}`,
    `L ${right - radius + j()} ${top + j()}`,
    `Q ${right + j()} ${top + j()} ${right + j()} ${top + radius + j()}`,
    `L ${right + j()} ${bottom - radius + j()}`,
    `Q ${right + j()} ${bottom + j()} ${right - radius + j()} ${bottom + j()}`,
    `L ${left + radius + j()} ${bottom + j()}`,
    `Q ${left + j()} ${bottom + j()} ${left + j()} ${bottom - radius + j()}`,
    `L ${left + j()} ${top + radius + j()}`,
    `Q ${left + j()} ${top + j()} ${left + radius + j()} ${top + j()}`,
    "Z"
  ].join(" ");

  const tailBaseX = left + bounds.w * (0.32 + rand() * 0.38);
  const tailBaseY = bottom - 2;
  const tail = [
    { x: tailBaseX - 8 + j(), y: tailBaseY + j() },
    { x: tailBaseX + 9 + j(), y: tailBaseY + j() },
    { x: bounds.tailX + j(), y: bounds.tailY + j() }
  ];

  return { path, tail };
}

function dispatchStageEvent(name: "odyssey:comic-stage-ready" | "odyssey:comic-stage-unavailable", detail?: unknown): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function ComicStageKonva({
  sequence,
  focusPanelIndex,
  onPanelSelect,
  visualMode = "default"
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 740 });
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [renderUnavailable, setRenderUnavailable] = useState(false);
  const [rendering, setRendering] = useState(false);
  const hasExternalFocus = typeof focusPanelIndex === "number";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const width = Math.max(STAGE_MIN_WIDTH, host.clientWidth);
      const height = Math.max(STAGE_MIN_HEIGHT, Math.round(width * STAGE_RATIO));
      setStageSize({ width, height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const visiblePanels = useMemo(() => {
    if (!sequence) return [];
    if (typeof focusPanelIndex === "number") {
      const focused = sequence.panels[focusPanelIndex];
      return focused ? [focused] : [];
    }
    return sequence.panels;
  }, [sequence, focusPanelIndex]);

  const panelItems = useMemo<PanelRenderItem[]>(() => {
    return visiblePanels.map((panel, idx) => ({
      panel,
      listIndex: idx,
      displayIndex: hasExternalFocus ? focusPanelIndex ?? idx : idx,
      frame: panelFrame(panel, stageSize.width, stageSize.height, hasExternalFocus)
    }));
  }, [visiblePanels, hasExternalFocus, focusPanelIndex, stageSize.width, stageSize.height]);

  useEffect(() => {
    if (hasExternalFocus) {
      setActivePanelIndex(0);
      return;
    }

    setActivePanelIndex((prev) => clamp(prev, 0, Math.max(0, panelItems.length - 1)));
  }, [hasExternalFocus, panelItems.length]);

  const bubbleTheme = useMemo(() => resolveBubbleTheme(sequence, visualMode), [sequence, visualMode]);
  const stageBg = visualMode === "monochrome" ? STAGE_BG_MONOCHROME : STAGE_BG_DEFAULT;
  const panelActiveStroke = visualMode === "monochrome" ? "#f0f0f0" : "#111111";
  const panelHoverStroke = visualMode === "monochrome" ? "#cccccc" : "#3a3a3a";
  const panelIdleStroke = visualMode === "monochrome" ? "rgba(255,255,255,0.34)" : "rgba(0,0,0,0.35)";
  const captionTitleColor = visualMode === "monochrome" ? "#f6f6f6" : "#1a1816";
  const captionBodyColor = visualMode === "monochrome" ? "rgba(240, 240, 240, 0.9)" : "rgba(24, 22, 19, 0.86)";
  const sfxFillColor = visualMode === "monochrome" ? "rgba(250, 250, 250, 0.82)" : "rgba(17, 14, 11, 0.78)";
  const sfxStrokeColor = visualMode === "monochrome" ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.24)";
  const bubbleShadowColor = visualMode === "monochrome" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.25)";

  const drawStage = useCallback(async () => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || !sequence || !panelItems.length) return () => {};

    setRendering(true);
    setRenderUnavailable(false);

    let disposed = false;
    let hostKeyHandler: ((event: KeyboardEvent) => void) | null = null;
    const fabricModule = (await import("fabric")) as unknown as FabricCtorModule;
    const CanvasCtor = fabricModule.Canvas;
    const RectCtor = fabricModule.Rect;
    const TextCtor = fabricModule.Text;
    const ImageCtor = fabricModule.FabricImage ?? fabricModule.Image;
    const GroupCtor = fabricModule.Group;
    const PathCtor = fabricModule.Path;
    const PolygonCtor = fabricModule.Polygon;

    if (!CanvasCtor || !RectCtor || !TextCtor || !ImageCtor || !GroupCtor || !PathCtor || !PolygonCtor) {
      throw new Error("fabric_constructors_unavailable");
    }

    const canvas = new CanvasCtor(canvasEl, {
      selection: false,
      renderOnAddRemove: false,
      preserveObjectStacking: true,
      backgroundColor: stageBg
    });

    canvas.setDimensions({ width: stageSize.width, height: stageSize.height });
    const camera = createFabricCameraController(canvas);

    const frameBorders: FabricObjectLike[] = [];
    const panelRects: PanelFrame[] = [];

    const paperNoise = new RectCtor({
      left: 0,
      top: 0,
      width: stageSize.width,
      height: stageSize.height,
      selectable: false,
      evented: false,
      fill: "rgba(255,255,255,0.01)"
    });
    canvas.add(paperNoise);

    const contentBounds = (): { left: number; top: number; width: number; height: number } | null => {
      if (!panelRects.length) return null;
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      for (const rect of panelRects) {
        left = Math.min(left, rect.x);
        top = Math.min(top, rect.y);
        right = Math.max(right, rect.x + rect.w);
        bottom = Math.max(bottom, rect.y + rect.h);
      }
      if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(right) || !Number.isFinite(bottom)) {
        return null;
      }
      return {
        left,
        top,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top)
      };
    };

    const centerContent = (zoom: number) => {
      const bounds = contentBounds();
      if (!bounds) return;
      const z = clamp(zoom, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
      const tx = (stageSize.width - bounds.width * z) / 2 - bounds.left * z;
      const ty = (stageSize.height - bounds.height * z) / 2 - bounds.top * z;
      canvas.setViewportTransform([z, 0, 0, z, tx, ty]);
      canvas.requestRenderAll();
    };

    const setActive = (index: number, emit = true, focusCamera = true) => {
      if (hasExternalFocus) return;
      const clamped = clamp(index, 0, panelItems.length - 1);
      setActivePanelIndex(clamped);
      frameBorders.forEach((border, i) => {
        border.set({
            stroke: i === clamped ? panelActiveStroke : panelIdleStroke,
            strokeWidth: i === clamped ? 4.2 : 2.2
          });
      });
      const rect = panelRects[clamped];
      if (rect && focusCamera) {
        camera.focusRect({ left: rect.x, top: rect.y, width: rect.w, height: rect.h }, { padding: 32, durationMs: 250 });
      }
      const next = panelItems[clamped];
      if (emit && next) {
        onPanelSelect?.(next.displayIndex);
      }
      canvas.requestRenderAll();
    };

    for (const item of panelItems) {
      if (disposed) break;
      const { panel, frame, listIndex } = item;
      panelRects.push(frame);

      const inkTheme = resolveInkTheme(sequence, panel, visualMode);
      const rasterKey = inkRasterCache.keyFor({
        panel,
        sequence,
        width: Math.round(frame.w),
        height: Math.round(frame.h),
        theme: inkTheme
      });

      const raster = await inkRasterCache.getOrCreate(rasterKey, async () => {
        return await renderInkRaster({
          panel,
          width: Math.max(120, Math.round(frame.w)),
          height: Math.max(120, Math.round(frame.h)),
          seed: `${sequence.meta.sourceHash}:${panel.panelId}:${inkTheme.themeId}`,
          theme: inkTheme
        });
      });

      if (disposed) break;

      const panelImage = new ImageCtor(raster, {
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        selectable: false,
        evented: false,
        opacity: 0.98
      });
      canvas.add(panelImage);

      const border = new RectCtor({
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        rx: 6,
        ry: 6,
        selectable: false,
        evented: false,
        fill: "rgba(0,0,0,0)",
        stroke: hasExternalFocus ? panelActiveStroke : panelIdleStroke,
        strokeWidth: hasExternalFocus ? 4.2 : 2.2
      });
      frameBorders.push(border);
      canvas.add(border);

      if (panel.caption?.title) {
        const caption = new TextCtor(panel.caption.title, {
          left: frame.x + 12,
          top: frame.y + 8,
          width: frame.w - 24,
          fontSize: 20,
          fontFamily: "STKaiti, KaiTi, serif",
          fill: captionTitleColor,
          selectable: false,
          evented: false
        });
        canvas.add(caption);
      }

      if (panel.caption?.text) {
        const body = new TextCtor(panel.caption.text, {
          left: frame.x + 14,
          top: frame.y + 36,
          width: frame.w - 28,
          fontSize: 15,
          lineHeight: 1.35,
          fontFamily: "STKaiti, KaiTi, serif",
          fill: captionBodyColor,
          selectable: false,
          evented: false
        });
        canvas.add(body);
      }

      panel.sfxTexts.forEach((sfx, sfxIndex) => {
        const sfxText = new TextCtor(sfx.text, {
          left: frame.x + sfx.anchor.x * frame.w,
          top: frame.y + sfx.anchor.y * frame.h,
          fontSize: sfx.style === "impact" ? 30 : sfx.style === "rumble" ? 24 : 20,
          angle: sfx.rotateDeg ?? 0,
          fill: sfxFillColor,
          stroke: sfxStrokeColor,
          strokeWidth: sfx.style === "impact" ? 1.2 : 0,
          fontFamily: "KaiTi, STKaiti, serif",
          selectable: false,
          evented: false,
          id: `${panel.panelId}-sfx-${sfxIndex}`
        });
        canvas.add(sfxText);
      });

      panel.speech.forEach((speech, speechIndex) => {
        const style = resolveBubbleStyle(bubbleTheme, speech.bubbleStyle);
        const text = wrapText(`${speech.speaker}：${speech.text}`, bubbleTheme.constraints.maxLines);
        const bubbleW = clamp(138 + text.length * 5.5, bubbleTheme.constraints.minBubbleWidth, bubbleTheme.constraints.maxBubbleWidth);
        const bubbleH = clamp(64 + text.split("\n").length * 18, 56, frame.h * 0.58);

        const bubbleX = frame.x + clamp(speech.anchor.x, 0.05, 0.85) * (frame.w - bubbleW);
        const bubbleY = frame.y + clamp(speech.anchor.y, 0.04, 0.78) * (frame.h - bubbleH);
        const tailX = frame.x + clamp(speech.anchor.x + 0.08, 0.08, 0.95) * frame.w;
        const tailY = frame.y + clamp(speech.anchor.y + 0.26, 0.12, 0.96) * frame.h;

        const bubbleShape = createHandDrawnBubblePath({
          x: bubbleX,
          y: bubbleY,
          w: bubbleW,
          h: bubbleH,
          tailX,
          tailY,
          cornerBias: bubbleTheme.defaultStyle.cornerBias,
          seed: `${panel.panelId}:${speechIndex}:${sequence.meta.sourceHash}`
        });

        const bubblePath = new PathCtor(bubbleShape.path, {
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          selectable: false,
          evented: false,
          opacity: speech.bubbleStyle === "whisper" ? 0.9 : 0.98,
          shadow: {
            color: bubbleShadowColor,
            blur: 10,
            offsetX: 0,
            offsetY: 3
          }
        });

        const bubbleTail = new PolygonCtor(bubbleShape.tail, {
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: Math.max(1, style.strokeWidth - 0.5),
          selectable: false,
          evented: false,
          opacity: speech.bubbleStyle === "whisper" ? 0.9 : 0.98
        });

        const bubbleText = new TextCtor(text, {
          left: bubbleX + 12,
          top: bubbleY + 12,
          width: bubbleW - 24,
          fontFamily: bubbleTheme.typography.fontFamily,
          fontSize: bubbleTheme.typography.fontSize,
          lineHeight: bubbleTheme.typography.lineHeight,
          charSpacing: Math.round(bubbleTheme.typography.letterSpacing * 20),
          fill: bubbleTheme.typography.textColor,
          selectable: false,
          evented: false
        });

        const bubbleGroup = new GroupCtor([bubblePath, bubbleTail, bubbleText], {
          selectable: false,
          evented: false
        });
        canvas.add(bubbleGroup);
      });

      const hitbox = new RectCtor({
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        selectable: false,
        evented: !hasExternalFocus,
        hoverCursor: hasExternalFocus ? "default" : "pointer",
        fill: "rgba(0,0,0,0.001)",
        stroke: "rgba(0,0,0,0)",
        strokeWidth: 0
      });

      hitbox.on("mousedown", () => {
        if (hasExternalFocus) return;
        setActive(listIndex, true);
      });
      hitbox.on("mouseover", () => {
        if (hasExternalFocus) return;
        const borderRef = frameBorders[listIndex];
        if (!borderRef) return;
        borderRef.set({ stroke: panelHoverStroke, strokeWidth: 3 });
        canvas.requestRenderAll();
      });
      hitbox.on("mouseout", () => {
        if (hasExternalFocus) return;
        frameBorders.forEach((borderRef, i) => {
          borderRef.set({
            stroke: i === activePanelIndex ? panelActiveStroke : panelIdleStroke,
            strokeWidth: i === activePanelIndex ? 4.2 : 2.2
          });
        });
        canvas.requestRenderAll();
      });

      canvas.add(hitbox);
    }

    if (!hasExternalFocus && panelItems.length) {
      const initial = clamp(activePanelIndex, 0, panelItems.length - 1);
      setActive(initial, false, false);
      centerContent(1);
    } else {
      camera.reset();
      centerContent(1);
    }

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const wheelHandler = (event?: unknown) => {
      if (hasExternalFocus) return;
      const opt = event as { e?: WheelEvent } | undefined;
      const e = opt?.e;
      if (!e) return;
      e.preventDefault();
      const currentZoom = canvas.getZoom();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      const nextZoom = clamp(currentZoom + delta, STAGE_ZOOM_MIN, STAGE_ZOOM_MAX);
      if (nextZoom <= 1.02) {
        centerContent(nextZoom);
      } else {
        canvas.zoomToPoint({ x: e.offsetX, y: e.offsetY }, nextZoom);
        canvas.requestRenderAll();
      }
    };

    const mouseDownHandler = (event?: unknown) => {
      if (hasExternalFocus) return;
      const opt = event as { e?: MouseEvent } | undefined;
      const e = opt?.e;
      if (!e) return;
      if (canvas.getZoom() <= 1.02) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const mouseMoveHandler = (event?: unknown) => {
      if (!dragging || hasExternalFocus) return;
      const opt = event as { e?: MouseEvent } | undefined;
      const e = opt?.e;
      if (!e) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camera.panBy(dx, dy);
    };

    const mouseUpHandler = () => {
      dragging = false;
    };

    canvas.on("mouse:wheel", wheelHandler);
    canvas.on("mouse:down", mouseDownHandler);
    canvas.on("mouse:move", mouseMoveHandler);
    canvas.on("mouse:up", mouseUpHandler);

    const host = hostRef.current;
    if (host && !hasExternalFocus) {
      hostKeyHandler = (event: KeyboardEvent) => {
        if (!panelItems.length) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        setActive(activePanelIndex + delta, true);
      };
      host.addEventListener("keydown", hostKeyHandler);
    }

    canvas.renderAll();
    dispatchStageEvent("odyssey:comic-stage-ready", {
      panelCount: panelItems.length,
      sourceHash: sequence.meta.sourceHash
    });
    setRendering(false);

    return () => {
      disposed = true;
      camera.cancelAnimation();
      if (host && hostKeyHandler) {
        host.removeEventListener("keydown", hostKeyHandler);
      }
      canvas.dispose();
    };
  }, [
    activePanelIndex,
    bubbleTheme,
    bubbleShadowColor,
    captionBodyColor,
    captionTitleColor,
    hasExternalFocus,
    onPanelSelect,
    panelItems,
    panelActiveStroke,
    panelHoverStroke,
    panelIdleStroke,
    sequence,
    sfxFillColor,
    sfxStrokeColor,
    stageSize.height,
    stageSize.width,
    stageBg,
    visualMode
  ]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let disposed = false;

    if (!sequence || !panelItems.length || !canvasRef.current) {
      setRendering(false);
      setRenderUnavailable(false);
      return;
    }

    void drawStage()
      .then((result) => {
        if (disposed) {
          result?.();
          return;
        }
        cleanup = result;
      })
      .catch((error) => {
        if (disposed) return;
        setRendering(false);
        setRenderUnavailable(true);
        dispatchStageEvent("odyssey:comic-stage-unavailable", {
          reason: error instanceof Error ? error.message : "unknown"
        });
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [drawStage, panelItems.length, sequence]);

  if (!sequence) {
    return (
      <div className="comic-stage-konva" ref={hostRef} tabIndex={0}>
        <div className="story-hotspot-empty">暂无分镜数据</div>
      </div>
    );
  }

  if (renderUnavailable) {
    return (
      <div className="comic-stage-konva" ref={hostRef} tabIndex={0}>
        <div className="story-hotspot-empty">分镜渲染失败，已触发页面降级。</div>
      </div>
    );
  }

  return (
    <div
      className="comic-stage-konva"
      ref={hostRef}
      tabIndex={0}
      data-act-id={sequence.meta.actId ?? ""}
      data-bubble-theme-id={sequence.meta.bubbleThemeId ?? ""}
      data-visual-mode={visualMode}
    >
      {rendering ? <div className="comic-stage-loading">水墨分镜渲染中...</div> : null}
      <canvas
        ref={canvasRef}
        className="comic-stage-fabric-canvas"
        width={stageSize.width}
        height={stageSize.height}
        aria-label="漫画分镜舞台"
      />
    </div>
  );
}
