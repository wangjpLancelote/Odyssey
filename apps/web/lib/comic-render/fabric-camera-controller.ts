type FabricPointLike = {
  x: number;
  y: number;
};

type FabricCanvasLike = {
  getZoom: () => number;
  setZoom: (value: number) => void;
  getVpCenter: () => FabricPointLike;
  zoomToPoint: (point: FabricPointLike, value: number) => void;
  relativePan: (point: FabricPointLike) => void;
  viewportTransform?: number[] | null;
  setViewportTransform: (value: number[]) => void;
  requestRenderAll: () => void;
  getWidth: () => number;
  getHeight: () => number;
};

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AnimationState = {
  rafId: number | null;
};

const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function createFabricCameraController(canvas: FabricCanvasLike) {
  const animation: AnimationState = {
    rafId: null
  };

  const cancelAnimation = () => {
    if (animation.rafId !== null) {
      cancelAnimationFrame(animation.rafId);
      animation.rafId = null;
    }
  };

  const setZoom = (value: number, point?: FabricPointLike) => {
    const next = clamp(value, MIN_ZOOM, MAX_ZOOM);
    if (point) {
      canvas.zoomToPoint(point, next);
    } else {
      canvas.setZoom(next);
    }
    canvas.requestRenderAll();
  };

  const focusRect = (rect: RectLike, opts?: { padding?: number; durationMs?: number }) => {
    const padding = opts?.padding ?? 28;
    const durationMs = opts?.durationMs ?? 260;

    const vw = canvas.getWidth();
    const vh = canvas.getHeight();

    const targetZoom = clamp(
      Math.min(vw / Math.max(120, rect.width + padding * 2), vh / Math.max(120, rect.height + padding * 2)),
      MIN_ZOOM,
      MAX_ZOOM
    );
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startZoom = canvas.getZoom();
    const startCenter = canvas.getVpCenter();
    const startedAt = performance.now();

    cancelAnimation();
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const t = clamp(elapsed / durationMs, 0, 1);
      const eased = easeInOutCubic(t);

      const nextZoom = startZoom + (targetZoom - startZoom) * eased;
      const nextCenterX = startCenter.x + (centerX - startCenter.x) * eased;
      const nextCenterY = startCenter.y + (centerY - startCenter.y) * eased;
      canvas.zoomToPoint({ x: nextCenterX, y: nextCenterY }, nextZoom);
      canvas.requestRenderAll();

      if (t < 1) {
        animation.rafId = requestAnimationFrame(tick);
      } else {
        animation.rafId = null;
      }
    };

    animation.rafId = requestAnimationFrame(tick);
  };

  const panBy = (dx: number, dy: number) => {
    canvas.relativePan({ x: dx, y: dy });
    canvas.requestRenderAll();
  };

  const reset = () => {
    cancelAnimation();
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.requestRenderAll();
  };

  return {
    setZoom,
    focusRect,
    panBy,
    reset,
    cancelAnimation
  };
}
