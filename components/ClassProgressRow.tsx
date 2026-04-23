"use client";

import type { AnnualPlan, ClassProgress, ProgressHealth } from "@/types";
import HealthBadge from "./HealthBadge";

type Props = {
  progress: ClassProgress;
  annualPlan: AnnualPlan[];
  health: ProgressHealth | undefined;
  onChange: (next: ClassProgress) => void;
  onAdvance: () => void;
};

/**
 * 進度管理画面の1クラス行。
 * 単元セレクト / 完了時数 / 累計 / 「次の単元に進める」/ メモ / ヘルスバッジ
 */
export default function ClassProgressRow({
  progress,
  annualPlan,
  health,
  onChange,
  onAdvance,
}: Props) {
  const currentUnit = annualPlan.find((p) => p.unit_name === progress.current_unit_name);
  const isOverflowInUnit =
    currentUnit !== undefined && progress.completed_hours > currentUnit.allocated_hours;
  const currentUnitIndex = annualPlan.findIndex((p) => p.unit_name === progress.current_unit_name);
  const hasNextUnit = currentUnitIndex >= 0 && currentUnitIndex < annualPlan.length - 1;

  const updateField = <K extends keyof ClassProgress>(key: K, value: ClassProgress[K]) => {
    onChange({ ...progress, [key]: value });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      {/* ヘッダー：クラス / ヘルスバッジ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded bg-blue-100 px-2.5 py-1 text-sm font-bold text-blue-700">
            {progress.class_code}
          </span>
          <span className="text-xs text-slate-500">{progress.grade}年</span>
        </div>
        {health && <HealthBadge health={health} compact />}
      </div>

      {/* 編集フィールド */}
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_100px_100px_auto]">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">現在の単元</label>
          <select
            value={progress.current_unit_name}
            onChange={(e) => updateField("current_unit_name", e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {annualPlan.map((p) => (
              <option key={p.unit_name} value={p.unit_name}>
                {p.unit_no !== null ? `${p.unit_no}. ` : ""}
                {p.unit_name}（{p.allocated_hours}h）
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            完了時数
            {currentUnit && (
              <span className="ml-1 text-slate-400">/ {currentUnit.allocated_hours}</span>
            )}
          </label>
          <input
            type="number"
            value={progress.completed_hours}
            onChange={(e) => updateField("completed_hours", Math.max(0, Number(e.target.value)))}
            min={0}
            className={`w-full rounded border px-3 py-1.5 text-sm focus:outline-none ${
              isOverflowInUnit
                ? "border-amber-400 bg-amber-50 focus:border-amber-500"
                : "border-slate-300 focus:border-blue-500"
            }`}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">累計</label>
          <input
            type="number"
            value={progress.total_completed_hours}
            onChange={(e) =>
              updateField("total_completed_hours", Math.max(0, Number(e.target.value)))
            }
            min={0}
            className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={onAdvance}
            disabled={!hasNextUnit}
            className="w-full rounded border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
            title={hasNextUnit ? "現単元を終了し次の単元へ" : "次の単元がありません"}
          >
            次の単元へ →
          </button>
        </div>
      </div>

      {/* 完了時数超過警告 */}
      {isOverflowInUnit && (
        <p className="mt-2 text-xs text-amber-700">
          完了時数が全時数（{currentUnit.allocated_hours}h）を超えています。「次の単元へ」で繰り上げてください。
        </p>
      )}

      {/* メモ */}
      <div className="mt-3">
        <label className="mb-1 block text-xs font-medium text-slate-600">メモ</label>
        <input
          type="text"
          value={progress.memo}
          onChange={(e) => updateField("memo", e.target.value)}
          placeholder="授業中の気づきや特記事項"
          className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
