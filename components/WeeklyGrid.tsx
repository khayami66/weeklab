"use client";

import { formatDate } from "@/lib/date";
import type { Weekday, WeeklyPlan } from "@/types";
import LessonCard from "./LessonCard";

const WEEKDAYS: readonly Weekday[] = ["月", "火", "水", "木", "金", "土"];

type Props = {
  plan: WeeklyPlan[];
  weekDates: Date[]; // 月〜土の6日
  /** 1コマのインライン編集用コールバック（メモ変更など）。null の場合は閲覧専用。 */
  onMemoChange?: (date: string, period: number, classCode: string, memo: string) => void;
  /** 閲覧専用モード（アーカイブ表示用） */
  readOnly?: boolean;
};

/**
 * 週案の曜日別表示。
 * 月〜土の6列を横並びに、各列で当日の全コマを縦に並べる。
 */
export default function WeeklyGrid({ plan, weekDates, onMemoChange, readOnly }: Props) {
  const byDate = new Map<string, WeeklyPlan[]>();
  for (const p of plan) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  // 各日を時限順に
  for (const list of byDate.values()) {
    list.sort((a, b) => a.period - b.period);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {weekDates.map((date, i) => {
        const dateKey = formatDate(date, "YYYY-MM-DD");
        const lessons = byDate.get(dateKey) ?? [];
        const weekday = WEEKDAYS[i];
        const isEmptyDay = lessons.length === 0;
        return (
          <section
            key={dateKey}
            className={`rounded-lg border p-3 ${
              isEmptyDay ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <header className="mb-2 flex items-baseline justify-between border-b border-slate-100 pb-2">
              <span className="text-sm font-semibold text-slate-700">
                {weekday}
                <span className="ml-1 text-xs text-slate-500">
                  {formatDate(date, "M/D")}
                </span>
              </span>
              {lessons.length > 0 && (
                <span className="text-xs text-slate-500">{lessons.length}コマ</span>
              )}
            </header>

            {isEmptyDay ? (
              <p className="text-xs text-slate-400">授業なし</p>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson) => (
                  <LessonCard
                    key={`${lesson.date}-${lesson.period}-${lesson.class_code}`}
                    lesson={lesson}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
