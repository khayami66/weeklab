"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import FirstLessonConfirmRow from "@/components/FirstLessonConfirmRow";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import WeekPicker from "@/components/WeekPicker";
import WeeklyGrid from "@/components/WeeklyGrid";
import WeekSummaryTable from "@/components/WeekSummaryTable";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useFirstLessonConfirms } from "@/hooks/useFirstLessonConfirms";
import { useOverrides } from "@/hooks/useOverrides";
import { useSetting } from "@/hooks/useSetting";
import { useTimetable } from "@/hooks/useTimetable";
import { formatDate, getMondayOf, getWeekDates, parseISODate } from "@/lib/date";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { advanceProgress } from "@/lib/progress";
import { generateWeeklyPlan } from "@/lib/weeklyPlan";
import type {
  AnnualPlan,
  ClassProgress,
  FirstLessonConfirm,
  LessonMaster,
} from "@/types";
import { getActivePacks } from "@/types";

interface PackBundle {
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
}

/**
 * Next.js 16 では useSearchParams を Suspense 境界で包む必要がある
 * （SSG 時のビルドエラー対策）。
 */
export default function WeeklyPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeader title="週案" />
          <p className="text-slate-500">読み込み中...</p>
        </div>
      }
    >
      <WeeklyPageContent />
    </Suspense>
  );
}

function WeeklyPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL ?week=YYYY-MM-DD から月曜日を決定（未指定なら今週の月曜）
  const weekParam = searchParams.get("week");
  const initialMonday = useMemo(() => {
    if (weekParam) return parseISODate(weekParam);
    return getMondayOf(new Date());
  }, [weekParam]);
  const [monday, setMondayState] = useState<Date>(initialMonday);

  useEffect(() => {
    setMondayState(initialMonday);
  }, [initialMonday]);

  const mondayKey = useMemo(() => formatDate(monday, "YYYY-MM-DD"), [monday]);

  const setMonday = useCallback(
    (next: Date) => {
      const key = formatDate(next, "YYYY-MM-DD");
      router.push(`/weekly?week=${key}`);
      setMondayState(next);
    },
    [router]
  );

  // データ取得
  const { setting, loading: settingLoading } = useSetting();
  const { timetable, loading: ttLoading } = useTimetable();
  const { overrides, loading: ovLoading } = useOverrides();
  const { progress, loading: progLoading, save: saveProgress } = useClassProgress();
  const { confirms, loading: confLoading, save: saveConfirms } = useFirstLessonConfirms(mondayKey);

  // パック取得
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

  // 確定済み週のリスト
  const [confirmedWeeks, setConfirmedWeeks] = useState<string[]>([]);
  const reloadConfirmedWeeks = useCallback(async () => {
    const list = await localDataSource.getConfirmedWeeks();
    setConfirmedWeeks(list);
  }, []);
  useEffect(() => {
    reloadConfirmedWeeks();
  }, [reloadConfirmedWeeks]);

  const isConfirmedWeek = confirmedWeeks.includes(mondayKey);

  // 先頭コマ確定の draft（ローカル編集状態）
  const [confirmsDraft, setConfirmsDraft] = useState<FirstLessonConfirm[] | null>(null);
  useEffect(() => {
    if (!confLoading) setConfirmsDraft(structuredClone(confirms));
  }, [confirms, confLoading, mondayKey]);

  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  const loading =
    settingLoading || ttLoading || ovLoading || progLoading || confLoading || packsLoading;

  if (loading || !setting || confirmsDraft === null) {
    return (
      <div>
        <PageHeader title="週案" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const weekDates = getWeekDates(monday);

  // 週案生成（draft の確定値を使う）
  const { plan, summary } = generateWeeklyPlan(
    monday,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    confirmsDraft
  );

  const hasTimetable = timetable.length > 0;

  // 先頭コマ draft の更新
  const handleConfirmChange = (classCode: string, next: FirstLessonConfirm | null) => {
    setConfirmsDraft((prev) => {
      if (!prev) return prev;
      const filtered = prev.filter((c) => c.class_code !== classCode);
      if (next === null) return filtered;
      return [...filtered, next];
    });
  };

  const confirmsDirty =
    JSON.stringify(confirms.slice().sort(cmpByClass)) !==
    JSON.stringify(confirmsDraft.slice().sort(cmpByClass));

  const handleSaveConfirms = async () => {
    setSaving(true);
    try {
      await saveConfirms(confirmsDraft);
      setToastKind("success");
      setToast("先頭コマを保存しました");
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // 「今週を実施済みに確定」
  const handleConfirmWeek = async () => {
    if (isConfirmedWeek) return;
    if (plan.length === 0) {
      setToastKind("info");
      setToast("この週に授業がないため確定できません");
      return;
    }
    const ok = window.confirm(
      `この週の ${plan.length} コマを実施済みとして進度に反映します。よろしいですか？`
    );
    if (!ok) return;

    setSaving(true);
    try {
      // draft の先頭コマ確定を先に保存
      if (confirmsDirty) {
        await saveConfirms(confirmsDraft);
      }

      // 各クラスの週内コマ数を集計
      const countByClass: Record<string, number> = {};
      for (const p of plan) {
        countByClass[p.class_code] = (countByClass[p.class_code] ?? 0) + 1;
      }

      // 各クラスの進度を「コマ数」回 advanceProgress
      const updated: ClassProgress[] = progress.map((p) => {
        const pack = packs[p.pack_id];
        if (!pack) return p;
        const n = countByClass[p.class_code] ?? 0;
        // 先頭コマ確定がある場合、その位置から再スタートするよう合わせる
        const confirm = confirmsDraft.find((c) => c.class_code === p.class_code);
        let current: ClassProgress = p;
        if (confirm) {
          current = {
            ...p,
            current_unit_name: confirm.unit_name,
            completed_hours: Math.max(0, confirm.lesson_no - 1),
          };
        }
        for (let i = 0; i < n; i++) {
          current = advanceProgress(current, pack.annualPlan);
        }
        return current;
      });

      await saveProgress(updated);
      await localDataSource.addConfirmedWeek(mondayKey);
      await reloadConfirmedWeeks();

      setToastKind("success");
      setToast(`${mondayKey} 週を実施済みに確定しました（進度を自動更新）`);
    } catch (err) {
      setToastKind("error");
      setToast(`確定に失敗しました: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUnconfirmWeek = async () => {
    if (!isConfirmedWeek) return;
    const ok = window.confirm(
      `この週の確定を取り消します。進度は自動では戻りません（補正が必要なら /progress で修正）。よろしいですか？`
    );
    if (!ok) return;
    await localDataSource.removeConfirmedWeek(mondayKey);
    await reloadConfirmedWeeks();
    setToastKind("info");
    setToast("確定を取り消しました");
  };

  const periodFrom = formatDate(weekDates[0], "M月D日");
  const periodTo = formatDate(weekDates[weekDates.length - 1], "M月D日");

  return (
    <div className="space-y-5">
      <PageHeader
        title="週案"
        subtitle={`自 ${periodFrom} 至 ${periodTo}`}
        actions={
          <Link
            href={`/print/weekly?week=${mondayKey}`}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            🖨 印刷
          </Link>
        }
      />

      <WeekPicker monday={monday} startDate={setting.start_date} onChange={setMonday} />

      {/* 時間割未登録の案内 */}
      {!hasTimetable && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          時間割が未登録です。
          <Link href="/settings" className="ml-1 underline">
            設定画面
          </Link>
          で基本時間割を入力してください。
        </section>
      )}

      {/* 確定済みバナー */}
      {isConfirmedWeek && (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span className="font-semibold">この週は実施済みに確定されています。</span>
          <button
            type="button"
            onClick={handleUnconfirmWeek}
            className="ml-3 rounded border border-emerald-300 bg-white px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
          >
            確定を取り消す
          </button>
        </section>
      )}

      {/* サマリ */}
      {hasTimetable && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">週実施・実施累計</h2>
          <WeekSummaryTable summary={summary} />
        </section>
      )}

      {/* 先頭コマ確定 */}
      {hasTimetable && progress.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">週先頭コマの確定</h2>
              <p className="mt-1 text-xs text-slate-500">
                各クラスの今週最初のコマを指定します。未確定の場合は ClassProgress からの推定値が使われます。
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveConfirms}
              disabled={!confirmsDirty || saving || isConfirmedWeek}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "確定値を保存"}
            </button>
          </div>
          <div className="space-y-2">
            {progress.map((p) => {
              const pack = packs[p.pack_id];
              if (!pack) return null;
              const confirm = confirmsDraft.find((c) => c.class_code === p.class_code);
              return (
                <FirstLessonConfirmRow
                  key={p.class_code}
                  classProgress={p}
                  annualPlan={pack.annualPlan}
                  lessonMaster={pack.lessonMaster}
                  confirm={confirm}
                  onChange={(next) => handleConfirmChange(p.class_code, next)}
                  disabled={isConfirmedWeek}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* 週案グリッド */}
      {hasTimetable && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">週の授業</h2>
          <WeeklyGrid plan={plan} weekDates={weekDates} />
        </section>
      )}

      {/* 今週を実施済みに確定 */}
      {hasTimetable && plan.length > 0 && !isConfirmedWeek && (
        <section className="sticky bottom-4 rounded-lg border border-blue-300 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <span className="font-semibold">{plan.length}コマ</span> 実施で進度が自動前進します
            </div>
            <button
              type="button"
              onClick={handleConfirmWeek}
              disabled={saving}
              className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              ✓ 今週を実施済みに確定
            </button>
          </div>
        </section>
      )}

      <Toast message={toast} kind={toastKind} onDismiss={() => setToast(null)} />
    </div>
  );
}

function cmpByClass(a: FirstLessonConfirm, b: FirstLessonConfirm): number {
  return a.class_code.localeCompare(b.class_code);
}
