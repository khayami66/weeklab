"use client";

import type { AnnualPlan, FirstLessonConfirm } from "@/types";

type Props = {
  classCode: string;
  annualPlan: AnnualPlan[];
  /** 現在この週で使われている単元・本時（確定値または推定値） */
  currentUnitName: string;
  currentLessonNo: number;
  /** 確定済みか（false なら ClassProgress からの推定値） */
  isConfirmed: boolean;
  onChange: (next: FirstLessonConfirm | null) => void;
  onClose: () => void;
};

/**
 * その週・そのクラスの「最初のコマ」で何をやるかを選ぶ。
 *
 * **週案グリッドの、実際に最初のコマにあたるカードの上で編集する。**
 * 以前は画面上部に全クラス分のセレクトを並べた独立セクションだったが、
 * 「どのコマの話なのか」がカードと離れていて分かりにくかった。
 *
 * 変更は即時保存する（時間割の変更と同じ挙動にそろえる）。
 * 選び直しても `ClassProgress` は変わらないので、いつでも「推定に戻す」で元に戻せる。
 */
export default function FirstLessonPicker({
  classCode,
  annualPlan,
  currentUnitName,
  currentLessonNo,
  isConfirmed,
  onChange,
  onClose,
}: Props) {
  const currentUnit = annualPlan.find((p) => p.unit_name === currentUnitName);
  const lessonOptions = currentUnit
    ? Array.from({ length: currentUnit.allocated_hours }, (_, i) => i + 1)
    : [];

  return (
    <div className="mt-2 space-y-2 rounded border border-blue-300 bg-blue-50 p-2">
      <p className="text-xs font-medium text-slate-700">
        {classCode} はこの時間から始める
      </p>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">単元</span>
        <select
          value={currentUnitName}
          onChange={(e) =>
            onChange({ class_code: classCode, unit_name: e.target.value, lesson_no: 1 })
          }
          className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
        >
          {annualPlan.map((p) => (
            <option key={p.unit_name} value={p.unit_name}>
              {p.unit_no !== null ? `${p.unit_no}. ` : ""}
              {p.unit_name}（{p.allocated_hours}h）
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-600">本時</span>
        <select
          value={currentLessonNo}
          onChange={(e) =>
            onChange({
              class_code: classCode,
              unit_name: currentUnitName,
              lesson_no: Number(e.target.value),
            })
          }
          disabled={lessonOptions.length === 0}
          className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
        >
          {lessonOptions.map((no) => (
            <option key={no} value={no}>
              {no}/{currentUnit?.allocated_hours} 時間目
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        {isConfirmed && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            title="進度から推定した値に戻す"
          >
            推定に戻す
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          閉じる
        </button>
      </div>

      <p className="text-xs text-slate-500">
        以降のコマは自動でずれます。前週が予定どおり進まなかったときは、ここで本時を戻してください。
      </p>
    </div>
  );
}
