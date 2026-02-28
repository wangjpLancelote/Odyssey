"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Group, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import type { ComicBubbleStyle, ComicBubbleTheme, ComicPanel, ComicSpeech, CompiledComicSequence } from "@odyssey/shared";

type Props = {
  sequence: CompiledComicSequence | null;
  focusPanelIndex?: number;
  onPanelSelect?: (index: number) => void;
};

type PanelFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type PanelRenderItem = {
  panel: ComicPanel;
  focused: boolean;
  frame: PanelFrame;
  displayIndex: number;
  listIndex: number;
};

type BubbleOverlayNode = {
  key: string;
  text: string;
  bubbleStyle: ComicBubbleStyle;
  bubbleFill: string;
  bubbleStroke: string;
  bubbleStrokeWidth: number;
  bubbleShadow: number;
  cornerBias: number;
  tailCurve: number;
  maxLines: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textColor: string;
  emphasis: number;
  impactRays: boolean;
  left: number;
  top: number;
  width: number;
  tipX: number;
  tipY: number;
};

type BubbleResolvedStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadow: number;
  cornerBias: number;
  tailCurve: number;
};

type FabricCanvasLike = {
  add: (item: unknown) => void;
  clear: () => void;
  dispose: () => void;
  renderAll: () => void;
  setDimensions: (value: { width: number; height: number }) => void;
};

type FabricRectLike = {
  set: (value: Record<string, unknown>) => void;
  on: (eventName: string, handler: (event?: unknown) => void) => void;
};

const PANEL_ACTIVE_STROKE = "#74d5ff";
const PANEL_HOVER_STROKE = "#c2e8ff";

const HERO_COLORS: Record<string, { fill: string; tint: string; edge: string }> = {
  "hero-day-amber": { fill: "#f8be53", tint: "#ffe7a2", edge: "#2b2d47" },
  "hero-night-cobalt": { fill: "#5676ff", tint: "#9bb3ff", edge: "#1d2341" },
  default: { fill: "#f2c04f", tint: "#ffe7ad", edge: "#242b4a" }
};

const DEFAULT_BUBBLE_THEME: ComicBubbleTheme = {
  themeId: "fallback-hero-bright",
  tone: "heroic",
  defaultStyle: {
    fill: "#fff9ec",
    stroke: "#2d2a45",
    strokeWidth: 2.6,
    shadow: 0.3,
    cornerBias: 0.68,
    tailCurve: 0.56
  },
  styleByBubbleType: {
    normal: {
      strokeWidth: 2.5
    },
    shout: {
      fill: "#fff3d5",
      stroke: "#f08c24",
      strokeWidth: 4.2,
      shadow: 0.44,
      cornerBias: 0.36,
      tailCurve: 0.32
    },
    whisper: {
      fill: "#eef2ff",
      stroke: "#8c94d9",
      strokeWidth: 2,
      shadow: 0.18,
      cornerBias: 0.9,
      tailCurve: 0.82
    }
  },
  typography: {
    fontFamily: "Bangers, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif",
    fontSize: 16,
    lineHeight: 1.34,
    letterSpacing: 0.14,
    textColor: "#1d2340"
  },
  ornaments: {
    speedline: { enabled: true, intensity: 0.52 },
    halftone: { enabled: true, intensity: 0.46 },
    impactRays: { enabled: true, intensity: 0.34 }
  },
  constraints: {
    minFontSize: 12,
    maxLines: 4,
    minBubbleWidth: 160,
    maxBubbleWidth: 320
  }
};

function colorForPanel(panel: ComicPanel): { fill: string; tint: string; edge: string } {
  return HERO_COLORS[panel.paletteToken ?? ""] ?? HERO_COLORS.default;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function panelFrame(panel: ComicPanel, width: number, height: number, focused: boolean): PanelFrame {
  if (focused) {
    return { x: 12, y: 12, w: width - 24, h: height - 24 };
  }

  return {
    x: panel.layout.x * width,
    y: panel.layout.y * height,
    w: panel.layout.w * width,
    h: panel.layout.h * height
  };
}

function comicalStyleForBubble(style: ComicBubbleStyle): string {
  if (style === "shout") return "shout";
  if (style === "whisper") return "thought";
  return "speech";
}

function resolveBubbleTheme(sequence: CompiledComicSequence | null): ComicBubbleTheme {
  return sequence?.meta.bubbleTheme ?? DEFAULT_BUBBLE_THEME;
}

function styleForBubble(theme: ComicBubbleTheme, bubbleStyle: ComicBubbleStyle, emphasis: number): BubbleResolvedStyle {
  const overrides = theme.styleByBubbleType[bubbleStyle] ?? {};
  const base: BubbleResolvedStyle = {
    fill: overrides.fill ?? theme.defaultStyle.fill,
    stroke: overrides.stroke ?? theme.defaultStyle.stroke,
    strokeWidth: overrides.strokeWidth ?? theme.defaultStyle.strokeWidth,
    shadow: overrides.shadow ?? theme.defaultStyle.shadow,
    cornerBias: overrides.cornerBias ?? theme.defaultStyle.cornerBias,
    tailCurve: overrides.tailCurve ?? theme.defaultStyle.tailCurve
  };

  if (bubbleStyle === "shout") {
    return {
      ...base,
      strokeWidth: Math.min(8, base.strokeWidth + emphasis * 1.8),
      shadow: Math.min(1, base.shadow + 0.16)
    };
  }

  if (bubbleStyle === "whisper") {
    return {
      ...base,
      strokeWidth: Math.max(1.2, base.strokeWidth - 0.5),
      shadow: Math.max(0.08, base.shadow - 0.08)
    };
  }

  return base;
}

function stripSpeakerPrefix(text: string): string {
  const splitIndex = text.indexOf("：");
  if (splitIndex <= 0 || splitIndex >= text.length - 1) {
    return text;
  }
  return text.slice(splitIndex + 1);
}

function wrapBubbleText(text: string, maxLines: number): { text: string; lines: number; truncated: boolean } {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return { text: "", lines: 1, truncated: false };
  }

  const maxCharsPerLine = 16;
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
      return {
        text: `${lines.slice(0, maxLines).join("\n").replace(/[。！!？?，,;；:\s]*$/, "")}…`,
        lines: maxLines,
        truncated: true
      };
    }
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    return {
      text: `${lines.slice(0, maxLines).join("\n").replace(/[。！!？?，,;；:\s]*$/, "")}…`,
      lines: maxLines,
      truncated: true
    };
  }

  return {
    text: lines.join("\n"),
    lines: Math.max(1, lines.length),
    truncated: false
  };
}

function bubbleEmphasis(speech: ComicSpeech): number {
  if (typeof speech.renderHint?.emphasis === "number") {
    return clamp01(speech.renderHint.emphasis);
  }

  if (speech.bubbleStyle === "shout") return 0.88;
  if (speech.bubbleStyle === "whisper") return 0.28;
  return 0.52;
}

function usePanelImageMap(panels: ComicPanel[]): Record<string, HTMLImageElement> {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});
  const targets = useMemo(
    () =>
      panels
        .map((panel) => ({
          panelId: panel.panelId,
          url: panel.illustration?.imageUrl ?? null
        }))
        .filter((item): item is { panelId: string; url: string } => Boolean(item.url)),
    [panels]
  );

  const signature = useMemo(() => targets.map((item) => `${item.panelId}:${item.url}`).join("|"), [targets]);
  const targetsRef = useRef(targets);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  useEffect(() => {
    let disposed = false;
    const currentTargets = targetsRef.current;
    if (!currentTargets.length) {
      setImages({});
      return;
    }

    void Promise.all(
      currentTargets.map(
        (target) =>
          new Promise<{ panelId: string; image: HTMLImageElement } | null>((resolve) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => resolve({ panelId: target.panelId, image });
            image.onerror = () => resolve(null);
            image.src = target.url;
          })
      )
    ).then((loaded) => {
      if (disposed) return;
      const nextMap: Record<string, HTMLImageElement> = {};
      for (const entry of loaded) {
        if (!entry) continue;
        nextMap[entry.panelId] = entry.image;
      }
      setImages(nextMap);
    });

    return () => {
      disposed = true;
    };
  }, [signature]);

  return images;
}

export function ComicStageKonva({ sequence, focusPanelIndex, onPanelSelect }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bubbleLayerRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<FabricCanvasLike | null>(null);
  const fabricRectsRef = useRef<FabricRectLike[]>([]);
  const [stageSize, setStageSize] = useState({ width: 1200, height: 740 });
  const [activePanelIndex, setActivePanelIndex] = useState(0);
  const [hoveredPanelIndex, setHoveredPanelIndex] = useState<number | null>(null);
  const hasExternalFocus = typeof focusPanelIndex === "number";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const width = Math.max(320, host.clientWidth);
      const height = Math.max(460, Math.round(width * 0.62));
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
      const panel = sequence.panels[focusPanelIndex];
      return panel ? [panel] : [];
    }
    return sequence.panels;
  }, [sequence, focusPanelIndex]);

  const panelRenderItems = useMemo<PanelRenderItem[]>(() => {
    const focused = hasExternalFocus;
    return visiblePanels.map((panel, idx) => ({
      panel,
      focused,
      frame: panelFrame(panel, stageSize.width, stageSize.height, focused),
      displayIndex: focused ? focusPanelIndex ?? idx : idx,
      listIndex: idx
    }));
  }, [visiblePanels, stageSize.width, stageSize.height, hasExternalFocus, focusPanelIndex]);

  const panelInteractionSignature = useMemo(
    () =>
      panelRenderItems
        .map(
          (item) =>
            `${item.panel.panelId}:${item.frame.x.toFixed(2)}:${item.frame.y.toFixed(2)}:${item.frame.w.toFixed(2)}:${item.frame.h.toFixed(2)}`
        )
        .join("|"),
    [panelRenderItems]
  );

  useEffect(() => {
    if (hasExternalFocus) {
      setActivePanelIndex(0);
      setHoveredPanelIndex(null);
      return;
    }

    setActivePanelIndex((current) => {
      const maxIndex = Math.max(0, panelRenderItems.length - 1);
      return Math.min(current, maxIndex);
    });
  }, [hasExternalFocus, panelRenderItems.length]);

  const bubbleTheme = useMemo(() => resolveBubbleTheme(sequence), [sequence]);
  const panelImageMap = usePanelImageMap(panelRenderItems.map((item) => item.panel));

  const bubbleOverlayNodes = useMemo(() => {
    const nodes: BubbleOverlayNode[] = [];
    for (const item of panelRenderItems) {
      const { panel, frame } = item;
      panel.speech.forEach((speech, speechIdx) => {
        const emphasis = bubbleEmphasis(speech);
        const resolvedStyle = styleForBubble(bubbleTheme, speech.bubbleStyle, emphasis);
        const wrapped = wrapBubbleText(
          `${speech.speaker}：${stripSpeakerPrefix(speech.text)}`,
          bubbleTheme.constraints.maxLines
        );
        const minBubbleWidth = Math.min(frame.w * 0.8, bubbleTheme.constraints.minBubbleWidth);
        const maxBubbleWidth = Math.min(frame.w * 0.9, bubbleTheme.constraints.maxBubbleWidth);
        const estimatedWidth = Math.max(minBubbleWidth, Math.min(maxBubbleWidth, 124 + wrapped.text.length * 6.8));
        const bubbleW = estimatedWidth;
        const bubbleH = Math.max(58, Math.min(frame.h * 0.55, 26 + wrapped.lines * (bubbleTheme.typography.fontSize * 1.2)));
        const bubbleX = frame.x + speech.anchor.x * (frame.w - bubbleW);
        const bubbleY = frame.y + speech.anchor.y * (frame.h - bubbleH);
        const anchorX = frame.x + clamp01(speech.anchor.x + 0.08) * frame.w;
        const anchorY = frame.y + clamp01(speech.anchor.y + 0.22) * frame.h;

        nodes.push({
          key: `${panel.panelId}-speech-${speechIdx}`,
          text: `${speech.speaker}：${wrapped.text}`,
          bubbleStyle: speech.bubbleStyle,
          bubbleFill: resolvedStyle.fill,
          bubbleStroke: resolvedStyle.stroke,
          bubbleStrokeWidth: resolvedStyle.strokeWidth,
          bubbleShadow: resolvedStyle.shadow,
          cornerBias: resolvedStyle.cornerBias,
          tailCurve: resolvedStyle.tailCurve,
          maxLines: bubbleTheme.constraints.maxLines,
          fontFamily: bubbleTheme.typography.fontFamily,
          fontSize: Math.max(
            bubbleTheme.constraints.minFontSize,
            Math.round(bubbleTheme.typography.fontSize - (wrapped.truncated ? 1 : 0))
          ),
          lineHeight: bubbleTheme.typography.lineHeight,
          letterSpacing: bubbleTheme.typography.letterSpacing,
          textColor: bubbleTheme.typography.textColor,
          emphasis,
          impactRays: bubbleTheme.ornaments.impactRays.enabled && speech.bubbleStyle === "shout",
          left: bubbleX + 10,
          top: bubbleY + 8,
          width: Math.max(120, bubbleW - 20),
          tipX: anchorX,
          tipY: anchorY
        });
      });
    }
    return nodes;
  }, [panelRenderItems, bubbleTheme]);

  const selectPanelByListIndex = useCallback(
    (nextIndex: number): void => {
      if (hasExternalFocus) return;
      if (!panelRenderItems.length) return;
      const clamped = Math.max(0, Math.min(nextIndex, panelRenderItems.length - 1));
      const nextItem = panelRenderItems[clamped];
      if (!nextItem) return;
      setActivePanelIndex(clamped);
      onPanelSelect?.(nextItem.displayIndex);
    },
    [hasExternalFocus, panelRenderItems, onPanelSelect]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || hasExternalFocus || panelRenderItems.length <= 1) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      selectPanelByListIndex(activePanelIndex + delta);
    };

    host.addEventListener("keydown", onKeyDown);
    return () => host.removeEventListener("keydown", onKeyDown);
  }, [hasExternalFocus, panelRenderItems.length, activePanelIndex, selectPanelByListIndex]);

  useEffect(() => {
    const canvasElement = interactionCanvasRef.current;
    if (!canvasElement || hasExternalFocus || panelRenderItems.length <= 1) {
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
      fabricRectsRef.current = [];
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const fabricModule = await import("fabric");
      if (disposed) return;

      const CanvasCtor = (fabricModule as { Canvas?: new (...args: unknown[]) => FabricCanvasLike }).Canvas;
      const RectCtor = (fabricModule as { Rect?: new (...args: unknown[]) => FabricRectLike }).Rect;
      if (!CanvasCtor || !RectCtor) {
        return;
      }

      const canvas = new CanvasCtor(canvasElement, {
        backgroundColor: "transparent",
        selection: false,
        renderOnAddRemove: false,
        preserveObjectStacking: true
      });
      fabricCanvasRef.current = canvas;
      fabricRectsRef.current = [];
      canvas.setDimensions({ width: stageSize.width, height: stageSize.height });

      panelRenderItems.forEach((item) => {
        const hotspot = new RectCtor({
          left: item.frame.x,
          top: item.frame.y,
          width: item.frame.w,
          height: item.frame.h,
          rx: 10,
          ry: 10,
          selectable: false,
          evented: true,
          hoverCursor: "pointer",
          fill: "rgba(0,0,0,0.001)",
          stroke: "rgba(0,0,0,0)",
          strokeWidth: 0
        });
        hotspot.on("mousedown", () => {
          hostRef.current?.focus();
          selectPanelByListIndex(item.listIndex);
        });
        hotspot.on("mouseover", () => {
          setHoveredPanelIndex(item.listIndex);
        });
        hotspot.on("mouseout", () => {
          setHoveredPanelIndex((prev) => (prev === item.listIndex ? null : prev));
        });
        fabricRectsRef.current.push(hotspot);
        canvas.add(hotspot);
      });
      canvas.renderAll();
      cleanup = () => {
        canvas.clear();
        canvas.dispose();
      };
    })().catch(() => {
      // Konva click handler remains as fallback.
    });

    return () => {
      disposed = true;
      cleanup?.();
      fabricCanvasRef.current = null;
      fabricRectsRef.current = [];
    };
  }, [hasExternalFocus, panelRenderItems, panelInteractionSignature, stageSize.width, stageSize.height, selectPanelByListIndex]);

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const rects = fabricRectsRef.current;
    if (!canvas || !rects.length || hasExternalFocus) {
      return;
    }

    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects[index];
      if (!rect) continue;
      const isActive = index === activePanelIndex;
      const isHovered = index === hoveredPanelIndex;
      rect.set({
        fill: isActive ? "rgba(116,213,255,0.14)" : isHovered ? "rgba(116,213,255,0.09)" : "rgba(0,0,0,0.001)",
        stroke: isActive ? PANEL_ACTIVE_STROKE : isHovered ? PANEL_HOVER_STROKE : "rgba(0,0,0,0)",
        strokeWidth: isActive ? 2.8 : isHovered ? 2 : 0
      });
    }
    canvas.renderAll();
  }, [activePanelIndex, hoveredPanelIndex, hasExternalFocus]);

  useEffect(() => {
    const bubbleLayer = bubbleLayerRef.current;
    if (!bubbleLayer) return;

    let disposed = false;
    void (async () => {
      const comicalModule = await import("comicaljs");
      if (disposed) return;

      const { Bubble, Comical } = comicalModule;
      const nodes = Array.from(bubbleLayer.querySelectorAll<HTMLElement>("[data-comic-bubble='1']"));

      if (!nodes.length) {
        if (Comical.activeContainers.has(bubbleLayer)) {
          Comical.stopEditing();
        }
        return;
      }

      for (const node of nodes) {
        const bubbleStyle = (node.dataset.bubbleStyle as ComicBubbleStyle | undefined) ?? "normal";
        const comicalStyle = comicalStyleForBubble(bubbleStyle);
        const fill = node.dataset.bubbleFill ?? "#ffffff";
        const stroke = node.dataset.bubbleStroke ?? "#2a2f47";
        const strokeWidth = Number(node.dataset.bubbleStrokeWidth ?? "2.5");
        const shadow = Number(node.dataset.bubbleShadow ?? "0.2");
        const cornerBias = Number(node.dataset.cornerBias ?? "0.6");
        const tailCurve = Number(node.dataset.tailCurve ?? "0.56");
        const tipX = Number(node.dataset.tipX ?? "0");
        const tipY = Number(node.dataset.tipY ?? "0");
        const left = Number(node.style.left.replace("px", ""));
        const top = Number(node.style.top.replace("px", ""));
        const width = Number(node.style.width.replace("px", ""));
        const height = Math.max(node.offsetHeight, 40);

        const defaultSpec = Bubble.getDefaultBubbleSpec(node, comicalStyle) as {
          tails?: Array<{ tipX: number; tipY: number; midpointX: number; midpointY: number }>;
          style: string;
          backgroundColors?: string[];
          outerBorderColor?: string;
        };
        const firstTail = defaultSpec.tails?.[0] ?? {
          tipX,
          tipY,
          midpointX: left + width * (0.38 + cornerBias * 0.24),
          midpointY: top + height + 12 + Math.round((1 - tailCurve) * 8)
        };

        const spec = {
          ...defaultSpec,
          style: comicalStyle,
          backgroundColors: [fill],
          outerBorderColor: stroke,
          outerBorderWidth: strokeWidth,
          shadows: [{ x: 0, y: 3, blur: 10, color: `rgba(0,0,0,${Math.min(0.65, shadow)})` }],
          tails: [
            {
              ...firstTail,
              midpointX: left + width * (0.38 + cornerBias * 0.24),
              midpointY: top + height + 12 + Math.round((1 - tailCurve) * 8),
              tipX,
              tipY
            }
          ]
        };

        node.setAttribute("data-bubble", JSON.stringify(spec));
      }

      if (!Comical.activeContainers.has(bubbleLayer)) {
        Comical.startEditing([bubbleLayer]);
      } else {
        Comical.update(bubbleLayer);
      }
      Comical.hideHandles();
    })().catch(() => {
      // Bubble fallback remains readable text without comic outline.
    });

    return () => {
      disposed = true;
    };
  }, [bubbleOverlayNodes]);

  useEffect(() => {
    return () => {
      void import("comicaljs")
        .then(({ Comical }) => {
          if (Comical.activeContainers.size) {
            Comical.stopEditing();
          }
        })
        .catch(() => {
          // Ignore teardown failures.
        });
    };
  }, []);

  return (
    <div
      className="comic-stage-konva"
      ref={hostRef}
      tabIndex={0}
      data-act-id={sequence?.meta.actId ?? ""}
      data-bubble-theme-id={sequence?.meta.bubbleThemeId ?? ""}
    >
      <Stage width={stageSize.width} height={stageSize.height}>
        <Layer>
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: stageSize.width, y: stageSize.height }}
            fillLinearGradientColorStops={[0, "#1a1f3b", 0.45, "#273f7a", 1, "#2f4f9f"]}
          />

          {panelRenderItems.map((item) => {
            const { panel, focused, frame, displayIndex, listIndex } = item;
            const theme = colorForPanel(panel);
            const panelImage = panelImageMap[panel.panelId];
            const isActive = !hasExternalFocus && listIndex === activePanelIndex;
            const isHovered = !hasExternalFocus && listIndex === hoveredPanelIndex;
            const edgeStroke = isActive ? PANEL_ACTIVE_STROKE : isHovered ? PANEL_HOVER_STROKE : theme.edge;
            const edgeWidth = isActive ? 8 : isHovered ? 7 : 6;

            return (
              <Group
                key={panel.panelId}
                onClick={() => selectPanelByListIndex(listIndex)}
                onTap={() => selectPanelByListIndex(listIndex)}
              >
                <Rect
                  x={frame.x}
                  y={frame.y}
                  width={frame.w}
                  height={frame.h}
                  cornerRadius={10}
                  fill={theme.fill}
                  stroke={edgeStroke}
                  strokeWidth={edgeWidth}
                  shadowColor="#000"
                  shadowOpacity={isActive ? 0.44 : 0.32}
                  shadowBlur={16}
                  shadowOffsetY={8}
                />

                {panelImage ? (
                  <KonvaImage
                    x={frame.x + 6}
                    y={frame.y + 6}
                    width={frame.w - 12}
                    height={frame.h - 12}
                    image={panelImage}
                    cornerRadius={8}
                  />
                ) : null}

                <Rect
                  x={frame.x + 6}
                  y={frame.y + 6}
                  width={frame.w - 12}
                  height={frame.h * 0.3}
                  cornerRadius={8}
                  fill={theme.tint}
                  opacity={panelImage ? 0.24 : 0.38}
                />

                <Text
                  x={frame.x + 14}
                  y={frame.y + 10}
                  width={frame.w - 28}
                  text={panel.caption?.title ?? `Panel ${displayIndex + 1}`}
                  fontSize={18}
                  fontStyle="bold"
                  fill="#18203a"
                  letterSpacing={0.4}
                />

                {panel.caption?.text ? (
                  <Text
                    x={frame.x + 14}
                    y={frame.y + 38}
                    width={frame.w - 28}
                    text={panel.caption.text}
                    fontSize={16}
                    lineHeight={1.35}
                    fill="#1c2140"
                  />
                ) : null}

                {panel.sfxTexts.map((sfx, sfxIdx) => {
                  const sfxX = frame.x + sfx.anchor.x * frame.w;
                  const sfxY = frame.y + sfx.anchor.y * frame.h;
                  const size = sfx.style === "impact" ? 34 : sfx.style === "rumble" ? 28 : 24;
                  const color = sfx.style === "impact" ? "#ff4e33" : sfx.style === "rumble" ? "#ffd368" : "#8ce1ff";

                  return (
                    <Text
                      key={`${panel.panelId}-sfx-${sfxIdx}`}
                      x={sfxX}
                      y={sfxY}
                      text={sfx.text}
                      fontSize={size}
                      fontStyle="bold"
                      fill={color}
                      stroke="#1f1f34"
                      strokeWidth={2}
                      rotation={sfx.rotateDeg ?? 0}
                      shadowColor="#000"
                      shadowBlur={6}
                      shadowOpacity={0.5}
                    />
                  );
                })}

                {focused && panel.illustration?.source === "replicate" ? (
                  <Text
                    x={frame.x + 16}
                    y={frame.y + frame.h - 26}
                    width={frame.w - 28}
                    text="Replicate"
                    fontSize={12}
                    letterSpacing={0.1}
                    fill="#edf4ff"
                  />
                ) : null}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <canvas
        ref={interactionCanvasRef}
        className={`comic-interaction-layer ${hasExternalFocus || panelRenderItems.length <= 1 ? "is-disabled" : ""}`}
        width={stageSize.width}
        height={stageSize.height}
        aria-hidden
      />

      <div className="comic-bubble-layer" ref={bubbleLayerRef} aria-hidden>
        {bubbleOverlayNodes.map((node) => (
          <div
            key={node.key}
            className={`comic-bubble-node ${node.impactRays ? "is-impact" : ""}`}
            data-comic-bubble="1"
            data-bubble-style={node.bubbleStyle}
            data-bubble-fill={node.bubbleFill}
            data-bubble-stroke={node.bubbleStroke}
            data-bubble-stroke-width={node.bubbleStrokeWidth}
            data-bubble-shadow={node.bubbleShadow}
            data-corner-bias={node.cornerBias}
            data-tail-curve={node.tailCurve}
            data-emphasis={node.emphasis}
            data-tip-x={node.tipX}
            data-tip-y={node.tipY}
            style={
              {
                left: node.left,
                top: node.top,
                width: node.width,
                color: node.textColor,
                fontFamily: node.fontFamily,
                fontSize: `${node.fontSize}px`,
                lineHeight: `${node.lineHeight}`,
                letterSpacing: `${node.letterSpacing}px`,
                maxHeight: `${Math.max(node.maxLines * node.fontSize * node.lineHeight, 42)}px`,
                backgroundColor: node.bubbleFill,
                borderColor: node.bubbleStroke,
                borderWidth: `${node.bubbleStrokeWidth}px`,
                borderStyle: "solid",
                borderRadius: `${Math.round(8 + node.cornerBias * 14)}px`,
                boxShadow: `0 4px 12px rgba(0,0,0,${Math.min(0.6, node.bubbleShadow + 0.12)})`,
                textShadow: node.bubbleStyle === "shout" ? "0 1px 0 rgba(255,255,255,0.75), 0 0 8px rgba(255,180,80,0.35)" : undefined
              } as CSSProperties
            }
          >
            <div className="comic-bubble-text">{node.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
