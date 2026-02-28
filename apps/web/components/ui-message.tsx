"use client";

import type { ReactNode } from "react";

export type MessageTone = "info" | "success" | "warning" | "error";

type MessageProps = {
  tone?: MessageTone;
  title?: string;
  children: ReactNode;
  className?: string;
};

const TONE_ICON: Record<MessageTone, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❗"
};

export function Message({ tone = "info", title, children, className }: MessageProps) {
  const role = tone === "error" ? "alert" : "status";
  return (
    <div className={["message", `message-${tone}`, className].filter(Boolean).join(" ")} role={role}>
      <span className="message-icon" aria-hidden>
        {TONE_ICON[tone]}
      </span>
      <div className="message-content">
        {title ? <div className="message-title">{title}</div> : null}
        <div className="message-body">{children}</div>
      </div>
    </div>
  );
}
