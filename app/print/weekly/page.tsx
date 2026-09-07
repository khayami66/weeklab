"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import PrintWeeklySheet from "@/components/PrintWeeklySheet";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useFirstLessonConfirms } from "@/hooks/useFirstLessonConfirms";
import { useOverrides } from "@/hooks/useOverrides";
import { useSetting } from "@/hooks/useSetting";
import { useTimetable } from "@/hooks/useTimetable";
import { formatDate, getMondayOf, getWeekDates, getWeekNumber, parseISODate } from "@/lib/date";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { computeMonthlyHoursByClass } from "@/lib/summary";
import { generateWeeklyPlan } from "@/lib/weeklyPlan";
import type { AnnualPlan, LessonMaster } from "@/types";
import { getActivePacks } from "@/types";

interface PackBundle {
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
}

/**
 * 週案の印刷画面（`/print/weekly?week=YYYY-MM-DD`）。
 *
 * 画面では紙面のプレビューと操作ボタンを出し、印刷時は
 * `no-print` を付けた要素（ナビ・ボタン・注記）が消えて紙面だけが残る。
 */
export default function PrintWeeklyPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">読み込み中...</p>}>
      <PrintWeeklyContent />
    </Suspense>
  );
}

function PrintWeeklyContent() {
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const monday = useMemo(
    () => (weekParam ? parseISODate(weekParam) : getMondayOf(new Date())),
    [weekParam]
  );
  const mondayKey = useMemo(() => formatDate(monday, "YYYY-MM-DD"), [monday]);

  const { setting, loading: settingLoading } = useSetting();
  const { timetable, loading: ttLoading } = useTimetable();
  const { overrides, loading: ovLoading } = useOverrides();
  const { progress, loading: progLoading } = useClassProgress();
  const { confirms, loading: confLoading } = useFirstLessonConfirms(mondayKey);

  const [packs, setPacks] = useState<Record<string, PackBundle>>({});
  const [packsLoading, setPacksLoading] = useState(true);
  const [confirmedWeeks, setConfirmedWeeks] = useState<string[]>([]);

  useEffect(() => {
    if (!setting) return;
    let cancelled = false;
    (async () => {
      const result: Record<string, PackBundle> = {};
      for (const id of getActivePacks(setting)) {
        const [ap, lm] = await Promise.all([
          localDataSource.getAnnualPlan(id),
          localDataSource.getEffectiveLessonMaster(id),
        ]);
        result[id] = { annualPlan: ap, lessonMaster: lm };
      }
      const weeks = await localDataSource.getConfirmedWeeks();
      if (!cancelled) {
        setPacks(result);
        setConfirmedWeeks(weeks);
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
    return <p className="text-slate-500">読み込み中...</p>;
  }

  const weekDates = getWeekDates(monday);
  const weekNo = getWeekNumber(monday, setting.start_date);

  const { plan, summary, cancelled } = generateWeeklyPlan(
    monday,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    confirms
  );

  const monthlyHours = computeMonthlyHoursByClass(
    monday.getFullYear(),
    monday.getMonth() + 1,
    timetable,
    overrides,
    confirmedWeeks
  );

  const hasTimetable = timetable.length > 0;

  return (
    <div>
      {/* 画面だけに出す操作。印刷では消える */}
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">週案の印刷</h1>
          <p className="mt-1 text-xs text-slate-500">
            下が実際の紙面（A4縦・1枚）です。ブラウザの印刷で
            <strong>用紙サイズ A4・向き 縦・余白は既定</strong>のまま出力してください。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/weekly?week=${mondayKey}`}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            週案に戻る
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            🖨 印刷する
          </button>
        </div>
      </div>

      {!hasTimetable ? (
        <p className="no-print rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          時間割が未登録です。設定画面で基本時間割を入力してください。
        </p>
      ) : (
        <>
          {/* 画面ではA4横の紙面に見えるよう枠を付ける。印刷では枠を消す */}
          <div className="print:border-0 print:p-0 print:shadow-none rounded border border-slate-300 bg-white p-4 shadow-sm">
            <PrintWeeklySheet
              setting={setting}
              weekNo={weekNo}
              weekDates={weekDates}
              plan={plan}
              cancelled={cancelled}
              summary={summary}
              monthlyHours={monthlyHours}
              weekConfirmed={confirmedWeeks.includes(mondayKey)}
            />
          </div>

          <p className="no-print mt-3 text-xs text-slate-500">
            <strong>週予定</strong>＝この週のコマ数（提出時点の予定）／
            <strong>週実施</strong>・<strong>月実施</strong>＝「実施済みに確定」した分／
            <strong>実施累計</strong>＝年度当初からの累計。
            <br />
            週案は実施前に提出するため、紙面には<strong>予定と実施を並べて</strong>います
            （画面の時数表は確定した分だけを出します）。
            休講にしたコマは打ち消し線と理由つきで印刷され、時数には数えません。
          </p>
        </>
      )}
    </div>
  );
}
