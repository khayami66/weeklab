"use client";

import { useMemo } from "react";
import type { GradeConfig, TeacherType, Timetable, Weekday } from "@/types";

type Props = {
  timetable: Timetable[];
  gradeConfigs: GradeConfig[];
  teacherType: TeacherType;
  /** 時限数の上限（デフォルト6） */
  maxPeriod?: number;
  onChange: (next: Timetable[]) => void;
};

const DAYS: readonly { key: Weekday; label: string; order: 1 | 2 | 3 | 4 | 5 | 6 }[] = [
  { key: "月", label: "月", order: 1 },
  { key: "火", label: "火", order: 2 },
  { key: "水", label: "水", order: 3 },
  { key: "木", label: "木", order: 4 },
  { key: "金", label: "金", order: 5 },
  { key: "土", label: "土", order: 6 },
];

/**
 * 基本時間割のマトリクス編集UI。
 *
 * - 行：時限（1〜maxPeriod限）
 * - 列：月〜土
 * - 各セル：クラスセレクト（grade_configs 由来）または空欄
 *
 * MVP は専科教員のみ対応。担任教員（homeroom）は将来拡張。
 */
export default function TimetableEditor({
  timetable,
  gradeConfigs,
  teacherType,
  maxPeriod = 6,
  onChange,
}: Props) {
  // 担任モードは未実装（型の先行確保のみ）
  if (teacherType === "homeroom") {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        担任教員モードの時間割編集は将来実装予定です（各コマで教科を選択する形になります）。
      </div>
    );
  }

  // (day, period) → class_code のマップを組み立て（編集中の値参照用）
  const matrix = useMemo(() => {
    const m: Record<Weekday, Record<number, string>> = {
      月: {},
      火: {},
      水: {},
      木: {},
      金: {},
      土: {},
    };
    for (const entry of timetable) {
      m[entry.day][entry.period] = entry.class_code;
    }
    return m;
  }, [timetable]);

  // 選択肢となるクラスコード一覧
  const classOptions = useMemo(() => {
    const codes: string[] = [];
    for (const gc of gradeConfigs) {
      for (let i = 1; i <= gc.class_count; i++) {
        codes.push(`${gc.grade}-${i}`);
      }
    }
    return codes;
  }, [gradeConfigs]);

  const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);

  const handleCellChange = (day: Weekday, period: number, newClassCode: string) => {
    // 既存のそのセルを除外
    const filtered = timetable.filter((t) => !(t.day === day && t.period === period));

    if (newClassCode === "") {
      // 空選択 → そのセルを削除
      onChange(filtered);
      return;
    }

    // 新規エントリを作成
    const gc = gradeConfigs.find((g) => newClassCode.startsWith(`${g.grade}-`));
    if (!gc) {
      // 想定外：grade_configs に該当学年がない（通常起きない）
      onChange(filtered);
      return;
    }

    const classNumber = Number(newClassCode.split("-")[1] ?? 0);
    const dayInfo = DAYS.find((d) => d.key === day)!;

    const newEntry: Timetable = {
      day,
      weekday_order: dayInfo.order,
      period,
      class_code: newClassCode,
      grade: gc.grade,
      class_number: classNumber,
      subject: "理科",
      note: "",
    };

    onChange([...filtered, newEntry]);
  };

  // 授業コマ数のサマリ
  const totalSlots = timetable.length;
  const perClassCount: Record<string, number> = {};
  for (const t of timetable) {
    perClassCount[t.class_code] = (perClassCount[t.class_code] ?? 0) + 1;
  }

  // 選択肢にないクラスコードが時間割に残っている場合の警告（grade_configs 変更後など）
  const staleCodes = Object.keys(perClassCount).filter((c) => !classOptions.includes(c));

  return (
    <div>
      {/* 学年構成が空の場合の案内 */}
      {classOptions.length === 0 && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          まず「学年構成」を登録してください。クラスが無いと時間割にクラスを設定できません。
        </div>
      )}

      {/* 警告：消えたクラスが時間割に残っている */}
      {staleCodes.length > 0 && (
        <div className="mb-3 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          以下のクラスが学年構成から削除されています：<b>{staleCodes.join(", ")}</b>
          <br />
          保存時にこれらのコマは自動的に削除されます。
        </div>
      )}

      {/* 時間割マトリクス */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 border border-slate-200 bg-slate-50 px-2 py-2 text-slate-600">
                時限
              </th>
              {DAYS.map((d) => (
                <th
                  key={d.key}
                  className="border border-slate-200 bg-slate-50 px-2 py-2 text-slate-600"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period}>
                <td className="border border-slate-200 bg-slate-50 px-2 py-2 text-center font-medium text-slate-600">
                  {period}限
                </td>
                {DAYS.map((d) => {
                  const currentValue = matrix[d.key][period] ?? "";
                  return (
                    <td key={d.key} className="border border-slate-200 p-1">
                      <select
                        value={currentValue}
                        onChange={(e) => handleCellChange(d.key, period, e.target.value)}
                        disabled={classOptions.length === 0}
                        className={`w-full rounded border px-2 py-1 text-sm focus:border-blue-500 focus:outline-none ${
                          currentValue
                            ? "border-blue-200 bg-blue-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <option value="">—</option>
                        {classOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* サマリ */}
      {totalSlots > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded bg-slate-100 px-2 py-1">
            合計 <b>{totalSlots}</b> コマ/週
          </span>
          {classOptions.map((c) => {
            const count = perClassCount[c] ?? 0;
            return (
              <span key={c} className="rounded bg-slate-100 px-2 py-1">
                {c}: <b>{count}</b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
