import type { ComicPanel } from "@odyssey/shared";
import type { InkRenderTheme } from "./ink-raster-cache";

type BrushRuntime = {
  p5Ctor: new (...args: unknown[]) => P5Instance;
  brushModule: Record<string, unknown> | null;
};

type P5Instance = {
  WEBGL: unknown;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  drawingContext: CanvasRenderingContext2D;
  noLoop: () => void;
  createCanvas: (w: number, h: number, mode?: unknown) => void;
  background: (value: string) => void;
  clear: () => void;
  push: () => void;
  pop: () => void;
  translate: (x: number, y: number) => void;
  stroke: (value: string) => void;
  fill: (value: string) => void;
  noFill: () => void;
  noStroke: () => void;
  strokeWeight: (w: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  circle: (x: number, y: number, d: number) => void;
  beginShape: () => void;
  curveVertex: (x: number, y: number) => void;
  endShape: () => void;
  map: (value: number, inMin: number, inMax: number, outMin: number, outMax: number, within?: boolean) => number;
  remove: () => void;
  setup?: () => void;
  draw?: () => void;
};

type P5BrushApi = {
  instance?: (p: P5Instance) => void;
  load?: (canvasId?: unknown) => void;
  seed?: (seed: string | number) => void;
  set?: (name: string, color: string, weight?: number) => void;
  stroke?: (value: string) => void;
  noStroke?: () => void;
  line?: (x1: number, y1: number, x2: number, y2: number) => void;
  noField?: () => void;
  reDraw?: () => void;
  reBlend?: () => void;
};

type InkRasterInput = {
  panel: ComicPanel;
  width: number;
  height: number;
  seed: string;
  theme: InkRenderTheme;
};

let runtimePromise: Promise<BrushRuntime> | null = null;

function createSeededRandom(seedText: string): () => number {
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

async function ensureBrushRuntime(): Promise<BrushRuntime> {
  if (runtimePromise) return runtimePromise;

  runtimePromise = (async () => {
    const p5Module = await import("p5");
    let brushModule: Record<string, unknown> | null = null;
    try {
      brushModule = (await import("p5.brush")) as Record<string, unknown>;
    } catch {
      brushModule = null;
    }

    const p5Ctor = (p5Module as unknown as { default?: new (...args: unknown[]) => P5Instance }).default;
    if (!p5Ctor) {
      throw new Error("p5_constructor_unavailable");
    }

    return {
      p5Ctor,
      brushModule
    };
  })();

  return runtimePromise;
}

function drawFallbackInk(ctx: CanvasRenderingContext2D, input: InkRasterInput): void {
  const rand = createSeededRandom(input.seed);
  const { width, height, theme, panel } = input;

  ctx.fillStyle = theme.paperColor;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 64; i += 1) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 4 + rand() * 28;
    ctx.fillStyle = `rgba(0,0,0,${0.015 + rand() * 0.03})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = `rgba(20,18,16,${panel.fxTags.includes("speedline") ? 0.32 : 0.22})`;
  for (let i = 0; i < 18; i += 1) {
    const sx = -width * 0.15 + rand() * width * 1.3;
    const sy = rand() * height;
    const ex = sx + width * (0.2 + rand() * 0.7);
    const ey = sy + height * (-0.12 + rand() * 0.26);
    ctx.lineWidth = 0.6 + rand() * 2.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const cx = rand() * width;
    const cy = rand() * height;
    const len = 36 + rand() * 140;
    ctx.strokeStyle = `rgba(12, 10, 10, ${0.24 + rand() * 0.34})`;
    ctx.lineWidth = 1.2 + rand() * 3.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(
      cx + len * (0.2 + rand() * 0.2),
      cy - len * (0.22 + rand() * 0.1),
      cx + len * (0.65 + rand() * 0.2),
      cy + len * (-0.08 + rand() * 0.16),
      cx + len,
      cy + len * (-0.05 + rand() * 0.25)
    );
    ctx.stroke();
  }
}

async function drawWithP5(input: InkRasterInput): Promise<HTMLCanvasElement> {
  const runtime = await ensureBrushRuntime();
  const { p5Ctor, brushModule } = runtime;
  const brush = brushModule as P5BrushApi | null;

  return await new Promise<HTMLCanvasElement>((resolve, reject) => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "-10000px";
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const sketch = (p: P5Instance) => {
      if (brush?.instance) {
        brush.instance(p);
      }

      p.setup = () => {
        p.createCanvas(input.width, input.height, p.WEBGL);
        if (brush?.load) {
          try {
            brush.load(p);
          } catch {
            // Ignore and fallback to p5 primitives.
          }
        }
        p.noLoop();
      };

      p.draw = () => {
        try {
          const rand = createSeededRandom(input.seed);
          p.clear();
          p.background(input.theme.paperColor);
          p.push();
          p.translate(-input.width / 2, -input.height / 2);

          if (brush?.seed) {
            brush.seed(input.seed);
          }
          if (brush?.noField) {
            brush.noField();
          }
          if (brush?.set) {
            brush.set("charcoal", input.theme.inkColor, 1.15);
          }
          if (brush?.stroke) {
            brush.stroke(input.theme.inkColor);
          }

          for (let i = 0; i < 14; i += 1) {
            const x1 = rand() * input.width;
            const y1 = rand() * input.height;
            const x2 = x1 + input.width * (0.18 + rand() * 0.42);
            const y2 = y1 + input.height * (-0.08 + rand() * 0.16);
            if (brush?.line) {
              brush.line(x1, y1, x2, y2);
            } else {
              p.stroke(input.theme.inkColor);
              p.strokeWeight(1.2 + rand() * 2.2);
              p.line(x1, y1, x2, y2);
            }
          }

          p.noStroke();
          p.fill("rgba(0,0,0,0.04)");
          for (let i = 0; i < 48; i += 1) {
            p.circle(rand() * input.width, rand() * input.height, 2 + rand() * 10);
          }

          if (input.panel.fxTags.includes("speedline")) {
            if (brush?.set) {
              brush.set("2H", input.theme.accentColor, 0.9);
            }
            if (brush?.stroke) {
              brush.stroke(input.theme.accentColor);
            }
            for (let i = 0; i < 24; i += 1) {
              const sx = -input.width * 0.1 + rand() * input.width * 1.2;
              const sy = rand() * input.height;
              const ex = sx + input.width * (0.1 + rand() * 0.8);
              const ey = sy + input.height * (-0.03 + rand() * 0.08);
              if (brush?.line) {
                brush.line(sx, sy, ex, ey);
              } else {
                p.stroke(input.theme.accentColor);
                p.strokeWeight(0.8 + rand() * 1.4);
                p.line(sx, sy, ex, ey);
              }
            }
          }

          if (brush?.reDraw) {
            brush.reDraw();
          }
          if (brush?.reBlend) {
            brush.reBlend();
          }

          p.pop();

          const output = document.createElement("canvas");
          output.width = input.width;
          output.height = input.height;
          const outputCtx = output.getContext("2d");
          if (!outputCtx) {
            throw new Error("ink_output_ctx_unavailable");
          }
          outputCtx.drawImage(p.canvas, 0, 0);

          finish(() => {
            resolve(output);
          });
        } catch (error) {
          finish(() => {
            reject(error);
          });
        } finally {
          setTimeout(() => {
            p.remove();
            host.remove();
          }, 0);
        }
      };
    };

    try {
      void new p5Ctor(sketch, host);
    } catch (error) {
      host.remove();
      reject(error);
    }
  });
}

export async function renderInkRaster(input: InkRasterInput): Promise<HTMLCanvasElement> {
  try {
    return await drawWithP5(input);
  } catch {
    const fallback = document.createElement("canvas");
    fallback.width = input.width;
    fallback.height = input.height;
    const ctx = fallback.getContext("2d");
    if (!ctx) {
      throw new Error("ink_fallback_ctx_unavailable");
    }
    drawFallbackInk(ctx, input);
    return fallback;
  }
}
