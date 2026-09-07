"use client";

import { useState } from "react";

type Props = {
  classCodes: string[];
  onAdd: (period: number, classCode: string, memo: string) => void;
  onClose: () => void;
};

/** 時限の選択肢。基本時間割エディタと同じ 1〜6 限 */
const PERIODS = [1, 2, 3, 4, 5, 6];

/**
 * 授業を追加するフォーム（土曜授業・振替先など）。
 *
 * 「空きスロットをクリック」にしていないのは、週案グリッドが
 * 日ごとに**既存のコマだけ**を縦に並べる形で、1〜6限の空き枠を描いていないため。
 * 6×6のマス目を新設するのはこの画面の性格に合わないので、
 * 日のヘッダから時限とクラスを選ぶ形にしている（実装プラン §3.3）。
 */
export default function AddSlotForm({ classCodes, onAdd, onClose }: Props) {
  const [period, setPeriod] = useState<number>(1);
  const [classCode, setClassCode] = useState("");
  const [memo, setMemo] = useState("");

  return (
    <div className="mt-2 space-y-2 rounded border border-emerald-300 bg-emerald-50 p-2">
      <div className="flex gap-2">
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
