"use client";

import { useEffect } from "react";

type Kind = "success" | "info" | "error";

type Props = {
  message: string | null;
  kind?: Kind;
  durationMs?: number;
  onDismiss: () => void;
};

const KIND_CLASSES: Record<Kind, string> = {
  success: "bg-emerald-600 text-white",
  info: "bg-slate-800 text-white",
  error: "bg-rose-600 text-white",
};

/**
 * 画面右下に一時的に表示されるトースト通知。
 * 呼び出し側で `{ message, setMessage }` を保持し、本コンポーネントに渡す。
 * 指定時間経過後に自動で `onDismiss` を呼ぶ。
 */
export default function Toast({ message, kind = "success", durationMs = 3000, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${KIND_CLASSES[kind]}`}
    >
      {message}
    </div>
  );
}
