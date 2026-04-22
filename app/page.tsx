"use client";

import { useSetting } from "@/hooks/useSetting";
import { formatDate, getWeekNumber } from "@/lib/date";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export default function HomePage() {
  const { setting, loading } = useSetting();

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ホーム</h1>
        <p className="mt-4 text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (!setting) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ホーム</h1>
        <p className="mt-4 text-rose-600">設定が読み込めませんでした。</p>
      </div>
    );
  }

  const today = new Date();
  const weekNo = getWeekNumber(today, setting.start_date);
  const todayLabel = `${formatDate(today, "YYYY年M月D日")}(${WEEKDAYS[today.getDay()]})`;
  const classesLabel = setting.grade_configs
    .map((g) => `${g.grade}年×${g.class_count}クラス`)
    .join("、");

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">ホーム</h1>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-lg text-slate-700">
          こんにちは、
          <span className="font-semibold text-blue-600">{setting.teacher_name}</span>
          さん
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {setting.school_name} / {setting.school_year}年度
        </p>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">今日</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{todayLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">週番号</dt>
            <dd className="mt-0.5 font-medium text-slate-800">
              {weekNo >= 1 ? `第 ${weekNo} 週` : `始業式前（差 ${weekNo - 1} 週）`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">始業式日</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{setting.start_date}</dd>
          </div>
          <div>
            <dt className="text-slate-500">担当</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{classesLabel}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-4 text-xs text-slate-500">
        ※ Phase 8 で「今日の授業カード」「今週サマリ」「クイックアクション」が追加されます。
      </p>
    </div>
  );
}
