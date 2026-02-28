"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { MessageTone } from "@/components/ui-message";

type ToastInput = {
  tone?: MessageTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type ToastItem = {
  id: string;
  tone: MessageTone;
  title?: string;
  message: string;
};

type ToastContextValue = {
  toast: (input: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_GLYPH: Record<MessageTone, string> = {
  info: "i",
  success: "+",
  warning: "!",
  error: "x"
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tone = input.tone ?? "info";
      const next: ToastItem = {
        id,
        tone,
        title: input.title,
        message: input.message
      };
      setItems((prev) => [...prev.slice(-3), next]);

      const duration = Math.max(1200, input.durationMs ?? 3000);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
            <div className="toast-head">
              <span className="toast-glyph" aria-hidden>
                {TOAST_GLYPH[item.tone]}
              </span>
              <span className="toast-title">{item.title ?? "系统提示"}</span>
              <button
                className="toast-close"
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="关闭提示"
              >
                ×
              </button>
            </div>
            <div className="toast-message">{item.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
