"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LessonCard from "@/components/LessonCard";
import PageHeader from "@/components/PageHeader";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useFirstLessonConfirms } from "@/hooks/useFirstLessonConfirms";
import { useOverrides } from "@/hooks/useOverrides";
import { useSetting } from "@/hooks/useSetting";
import { useTimetable } from "@/hooks/useTimetable";
import { formatDate, getMondayOf, getWeekDates, getWeekNumber } from "@/lib/date";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { generateWeeklyPlan, getLessonsForDate } from "@/lib/weeklyPlan";
import type { AnnualPlan, LessonMaster, Weekday } from "@/types";
import { getActivePacks } from "@/types";

const WEEKDAYS: readonly Weekday[] = ["月", "火", "水", "木", "金", "土"];
const WEEKDAY_LABELS_JS = ["日", "月", "火", "水", "木", "金", "土"] as const;

interface PackBundle {
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
}

export default function HomePage() {
  const { setting, loading: settingLoading } = useSetting();
  const { timetable, loading: ttLoading } = useTimetable();
  const { overrides, loading: ovLoading } = useOverrides();
  const { progress, loading: progLoading } = useClassProgress();

  const today = useMemo(() => new Date(), []);
  const monday = useMemo(() => getMondayOf(today), [today]);
  const mondayKey = useMemo(() => formatDate(monday, "YYYY-MM-DD"), [monday]);

  const { confirms, loading: confLoading } = useFirstLessonConfirms(mondayKey);

  const [packs, setPacks] = useState<Record<string, PackBundle>>({});
  const [packsLoading, setPacksLoading] = useState(true);

  useEffect(() => {
    if (!setting) return;
    let cancelled = false;
    (async () => {
      const ids = getActivePacks(setting);
      const result: Record<string, PackBundle> = {};
      for (const id of ids) {
        const [ap, lm] = await Promise.all([
          localDataSource.getAnnualPlan(id),
          localDataSource.getLessonMaster(id),
        ]);
        result[id] = { annualPlan: ap, lessonMaster: lm };
      }
      if (!cancelled) {
        setPacks(result);
        setPacksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setting]);

  const loading =
    settingLoading || ttLoading || ovLoading || progLoading || confLoading || packsLoading;

  if (loading || !setting) {
    return (
      <div>
        <PageHeader title="ホーム" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  // 今日の授業
  const todayLessons = getLessonsForDate(
    today,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    confirms
  ).sort((a, b) => a.period - b.period);

  // 今週の週案（サマリ用）
  const { plan: weekPlan } = generateWeeklyPlan(
    monday,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    confirms
  );

  const weekDates = getWeekDates(monday);
  const weekNo = getWeekNumber(today, setting.start_date);
  const todayLabel = `${formatDate(today, "YYYY年M月D日")}(${WEEKDAY_LABELS_JS[today.getDay()]})`;
  const periodFrom = formatDate(weekDates[0], "M月D日");
  const periodTo = formatDate(weekDates[weekDates.length - 1], "M月D日");

  // 曜日別のコマ数
  const perDayCount: Record<string, number> = {};
  for (const p of weekPlan) {
    perDayCount[p.date] = (perDayCount[p.date] ?? 0) + 1;
  }

  const hasTimetable = timetable.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="ホーム"
        subtitle={`${setting.school_name} / ${setting.teacher_name} 先生`}
      />

      {/* 今週ヘッダー */}
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm text-blue-600">今週</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {weekNo >= 1 ? `第 ${weekNo} 週` : `始業式前`}
            </p>
          </div>
          <p className="text-sm font-medium text-slate-700">
            自 {periodFrom} 至 {periodTo}
          </p>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          今日：{todayLabel} / 始業式：{setting.start_date}
        </p>
      </section>

      {/* 時間割未入力の案内 */}
      {!hasTimetable && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800">時間割が未登録です</h2>
          <p className="mt-1 text-sm text-amber-700">
            「時間割・例外」画面で自校の理科専科時間割を入力すると、
            今日の授業と週案が自動で表示されます。
          </p>
          <Link
            href="/timetable"
            className="mt-3 inline-block rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            時間割画面を開く →
          </Link>
        </section>
      )}

      {/* 今日の授業 */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">今日の授業</h2>
        {todayLessons.length === 0 ? (
          <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">
            今日は理科の授業がありません。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayLessons.map((lesson) => (
              <LessonCard
                key={`${lesson.date}-${lesson.period}-${lesson.class_code}`}
                lesson={lesson}
              />
            ))}
          </div>
        )}
      </section>

      {/* 今週のサマリ（曜日別コマ数） */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">今週のコマ数</h2>
        <div className="grid grid-cols-6 gap-2 rounded-lg border border-slate-200 bg-white p-4">
          {weekDates.map((date, i) => {
            const key = formatDate(date, "YYYY-MM-DD");
            const count = perDayCount[key] ?? 0;
            const isToday = key === formatDate(today, "YYYY-MM-DD");
            return (
              <div
                key={key}
                className={`rounded p-3 text-center ${
                  isToday ? "bg-blue-50 ring-2 ring-blue-400" : "bg-slate-50"
                }`}
              >
                <p className="text-xs text-slate-500">{WEEKDAYS[i]}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDate(date, "D日")}</p>
                <p className="mt-1 text-lg font-bold text-slate-800">{count}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* クイックアクション */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-800">クイックアクション</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { href: "/weekly", label: "週案" },
            { href: "/progress", label: "進度管理" },
            { href: "/timetable", label: "時間割" },
            { href: "/monthly", label: "月次集計" },
            { href: `/print/weekly?week=${mondayKey}`, label: "🖨 印刷" },
            { href: "/archive", label: "アーカイブ" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
