"use client";

import { useMemo } from "react";
import type { AnnualPlan, ClassProgress, FirstLessonConfirm, LessonMaster } from "@/types";
import { resolveCurrentLesson } from "@/lib/progress";

type Props = {
  classProgress: ClassProgress;
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
  /** この週のこのクラスの確定値（あれば）。なければ ClassProgress から推定 */
  confirm: FirstLessonConfirm | undefined;
  onChange: (next: FirstLessonConfirm | null) => void;
  disabled?: boolean;
};

/**
 * 1クラス分の「週先頭コマ確定」行。
 * 単元セレクト＋本時セレクトで、その週の最初のコマに何をやるかを指定。
 * デフォルトは ClassProgress から推定した次本時。
 */
export default function FirstLessonConfirmRow({
  classProgress,
  annualPlan,
  lessonMaster,
  confirm,
  onChange,
  disabled,
}: Props) {
  // 推定値（ClassProgress 由来）
  const resolved = useMemo(
    () => resolveCurrentLesson(classProgress, annualPlan, lessonMaster),
    [classProgress, annualPlan, lessonMaster]
  );

  const effectiveUnitName = confirm?.unit_name ?? resolved.unit_name;
  const effectiveLessonNo = confirm?.lesson_no ?? resolved.lesson_no;

  const currentUnit = annualPlan.find((p) => p.unit_name === effectiveUnitName);
  const unitLessonOptions = currentUnit
    ? Array.from({ length: currentUnit.allocated_hours }, (_, i) => i + 1)
    : [];

  const handleUnitChange = (newUnit: string) => {
    if (!newUnit) {
      onChange(null);
      return;
    }
    const next: FirstLessonConfirm = {
      class_code: classProgress.class_code,
      unit_name: newUnit,
      lesson_no: 1,
    };
    onChange(next);
  };

  const handleLessonChange = (newNo: number) => {
    const next: FirstLessonConfirm = {
      class_code: classProgress.class_code,
      unit_name: effectiveUnitName,
      lesson_no: newNo,
    };
    onChange(next);
  };

  const handleReset = () => {
    onChange(null);
  };

  const isConfirmed = confirm !== undefined;

  return (
    <div className="grid gap-2 rounded border border-slate-200 p-3 md:grid-cols-[80px_1fr_140px_auto]">
      <div className="flex items-center">
        <span className="rounded bg-blue-100 px-2 py-1 text-sm font-bold text-blue-700">
          {classProgress.class_code}
        </span>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">単元</label>
        <select
          value={effectiveUnitName}
          onChange={(e) => handleUnitChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
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
        <label className="mb-1 block text-xs font-medium text-slate-600">本時</label>
        <select
          value={effectiveLessonNo}
          onChange={(e) => handleLessonChange(Number(e.target.value))}
          disabled={disabled || unitLessonOptions.length === 0}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          {unitLessonOptions.map((no) => (
            <option key={no} value={no}>
              {no}/{currentUnit?.allocated_hours} 時間目
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-1">
        {isConfirmed ? (
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            title="推定値（ClassProgress 由来）に戻す"
          >
            推定に戻す
          </button>
        ) : (
          <span
            className="rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-500"
            title="ClassProgress から推定"
          >
            推定値
          </span>
        )}
      </div>
    </div>
  );
}
