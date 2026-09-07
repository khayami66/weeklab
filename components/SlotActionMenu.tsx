"use client";

import { useState } from "react";

export type SlotAction =
  | { type: "cancel"; reason: string }
  | { type: "replace"; toClassCode: string; memo: string };

type Props = {
  classCode: string;
  /** 差し替え先の候補（自クラスを除く） */
  classCodes: string[];
  onApply: (action: SlotAction) => void;
  onClose: () => void;
};

/**
 * 1コマに対する変更メニュー。
 *
 * **将来「単元を変える」をここに足す**（実装プラン §1.5）。
 * 本人の認識では「単元の入れ替え」と「急な変更」は同じ *修正* なので、
 * 最終的には同じメニューに並ぶべき。そのため選択肢を配列で持ち、
 * 追加しやすい構造にしている。
 */
export default function SlotActionMenu({ classCode, classCodes, onApply, onClose }: Props) {
  const [mode, setMode] = useState<"menu" | "cancel" | "replace">("menu");
  const [reason, setReason] = useState("");
  const [toClass, setToClass] = useState("");

  const others = classCodes.filter((c) => c !== classCode);

  if (mode === "menu") {
    return (
      <div className="mt-2 space-y-1.5 rounded border border-slate-300 bg-slate-50 p-2">
        <button
          type="button"
          onClick={() => setMode("cancel")}
          className="block w-full rounded bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-rose-50"
        >
          休講にする（行事・祝日）
        </button>
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => setMode("replace")}
            className="block w-full rounded bg-white px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
          >
            クラスを変える
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="block w-full px-2 py-1 text-left text-xs text-slate-500 hover:text-slate-700"
        >
          閉じる
        </button>
      </div>
    );
  }

  if (mode === "cancel") {
    return (
      <div className="mt-2 space-y-2 rounded border border-rose-300 bg-rose-50 p-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">理由</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：運動会練習"
            autoFocus
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApply({ type: "cancel", reason: reason.trim() })}
            className="flex-1 rounded bg-rose-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
          >
            休講にする
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
          >
            やめる
          </button>
        </div>
        <p className="text-xs text-slate-500">
          理由は週案に表示・印刷されます（空欄でも構いません）。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded border border-blue-300 bg-blue-50 p-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">
          このコマで授業するクラス
        </span>
        <select
          value={toClass}
          onChange={(e) => setToClass(e.target.value)}
          autoFocus
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        >
          <option value="">選択してください</option>
          {others.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">メモ（任意）</span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例：振替"
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={toClass === ""}
          onClick={() => onApply({ type: "replace", toClassCode: toClass, memo: reason.trim() })}
          className="flex-1 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          変更する
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600"
        >
          やめる
        </button>
      </div>
    </div>
  );
}
