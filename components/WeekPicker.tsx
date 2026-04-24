"use client";

import { formatDate, getMondayOf, getWeekNumber } from "@/lib/date";

type Props = {
  monday: Date;
  startDate: string; // 始業式日（週番号起点）
  onChange: (nextMonday: Date) => void;
};

/**
 * 週セレクタ：◀ 前週 / 今週 / 次週 ▶ ＋ 日付ピッカー。
 */
export default function WeekPicker({ monday, startDate, onChange }: Props) {
  const weekNo = getWeekNumber(monday, startDate);
  const today = new Date();
  const todayMonday = getMondayOf(today);
  const isThisWeek =
    formatDate(monday, "YYYY-MM-DD") === formatDate(todayMonday, "YYYY-MM-DD");

  const goPrev = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    onChange(d);
  };

  const goNext = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    onChange(d);
  };

  const goThisWeek = () => {
    onChange(todayMonday);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m, d] = e.target.value.split("-").map(Number);
    const picked = new Date(y, m - 1, d);
    onChange(getMondayOf(picked));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={goPrev}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        ◀ 前週
      </button>

      <button
        type="button"
        onClick={goThisWeek}
        disabled={isThisWeek}
        className={`rounded px-3 py-1.5 text-sm font-medium ${
          isThisWeek
            ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
            : "border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
        }`}
      >
        今週へ
      </button>

      <button
        type="button"
        onClick={goNext}
        className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        次週 ▶
      </button>

      <input
        type="date"
        value={formatDate(monday, "YYYY-MM-DD")}
        onChange={handleDateChange}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm"
      />

      <span className="ml-auto rounded bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
        第 {weekNo} 週
      </span>
    </div>
  );
}
