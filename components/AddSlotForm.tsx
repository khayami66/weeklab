"use client";

import { useState } from "react";

type Props = {
  classCodes: string[];
  /** 空きコマから追加する場合、その時限。渡されたら時限セレクトは出さない */
  fixedPeriod?: number;
  onAdd: (period: number, classCode: string, memo: string) => void;
  onClose: () => void;
};

/** 時限の選択肢。基本時間割エディタと同じ 1〜6 限 */
const PERIODS = [1, 2, 3, 4, 5, 6];

/**
 * 授業を追加するフォーム（土曜授業・振替先など）。
 *
 * 週案グリッドを「月〜土 × 1〜6限」の固定枠にしたので、
 * **空きコマの「＋」から直接追加できる**。その場合は時限が確定しているので
 * 時限セレクトを出さず、クラスだけ選ばせる（`fixedPeriod`）。
 */
export default function AddSlotForm({ classCodes, fixedPeriod, onAdd, onClose }: Props) {
  const [period, setPeriod] = useState<number>(fixedPeriod ?? 1);
  const [classCode, setClassCode] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-2">
      <div className="flex gap-2">
        {fixedPeriod === undefined && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">時限</span>
            <select
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              className="rounded border border-slate-300 px-2 py-1 text-xs"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}限
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-700">クラス</span>
          <select
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">選択してください</option>
            {classCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">メモ（任意）</span>
        <input
          type="text"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例：土曜授業／振替"
          className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={classCode === ""}
          onClick={() => onAdd(period, classCode, memo.trim())}
          className="flex-1 rounded bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          追加する
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
