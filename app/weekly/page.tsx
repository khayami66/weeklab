"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import {
  addSlot,
  cancelSlot,
  cancelWholeDay,
  clearWeekOverrides,
  overridesInWeek,
  removeOverride,
} from "@/lib/overrideEdit";
import { advanceProgress } from "@/lib/progress";
import { generateWeeklyPlan } from "@/lib/weeklyPlan";
import type {
  AnnualPlan,
  ClassProgress,
  FirstLessonConfirm,
  LessonMaster,
  TeacherSetting,
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
  const { overrides, loading: ovLoading, save: saveOverrides } = useOverrides();
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
          localDataSource.getEffectiveLessonMaster(id),
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

  // 先頭コマ確定は draft を持たず**即時保存**する。
  // 時間割の変更と同じ挙動にそろえ、「保存し忘れ」を作らないため。
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  const loading =
    settingLoading || ttLoading || ovLoading || progLoading || confLoading || packsLoading;

  if (loading || !setting) {
    return (
      <div>
        <PageHeader title="週案" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const weekDates = getWeekDates(monday);

  // 週案生成（保存済みの確定値を使う）
  const { plan, summary, cancelled } = generateWeeklyPlan(
    monday,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    confirms
  );

  const hasTimetable = timetable.length > 0;

  // ── 時間割の変更（週内例外）──
  // TimetableOverride は基本時間割への差分。取り消しは差分を消すだけで元に戻る。
  const weekDateKeys = weekDates.map((d) => formatDate(d, "YYYY-MM-DD"));
  const weekOverrides = overridesInWeek(overrides, weekDateKeys);
  const classCodes = listClassCodes(setting);

  const applyOverrides = async (next: typeof overrides, message: string) => {
    try {
      await saveOverrides(next);
      setToastKind("success");
      setToast(message);
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    }
  };

  const editHandlers = {
    classCodes,
    // 個別のコマは理由を聞かず即休講にする。
    // 1コマずつ入力させると行事の週で何度もダイアログが出て、週案作成が遅くなるため。
    // 理由は「この日をなくす」（1日まるごと）でのみ入力する。
    onCancelSlot: (date: string, period: number, code: string) =>
      applyOverrides(cancelSlot(overrides, date, period, code, ""), "休講にしました"),
    onAddSlot: (date: string, period: number, code: string, memo: string) =>
      applyOverrides(addSlot(overrides, date, period, code, memo), "授業を追加しました"),
    onCancelWholeDay: (date: string, reason: string) => {
      const slotsOfDay = plan.filter((pl) => pl.date === date);
      return applyOverrides(
        cancelWholeDay(overrides, date, slotsOfDay, reason),
        `${date} を休講にしました`
      );
    },
    onRestore: (date: string, period: number, code: string) =>
      applyOverrides(removeOverride(overrides, date, period, code), "元に戻しました"),
  };

  const handleClearWeek = async () => {
    if (!window.confirm("この週の時間割の変更をすべて取り消して、基本時間割に戻します。よろしいですか？"))
      return;
    await applyOverrides(clearWeekOverrides(overrides, weekDateKeys), "この週の変更を取り消しました");
  };

  /** 週の最初のコマで単元・本時を選んだとき。null なら推定値に戻す */
  const handleFirstLessonChange = async (
    classCode: string,
    next: FirstLessonConfirm | null
  ) => {
    const rest = confirms.filter((c) => c.class_code !== classCode);
    const updated = next === null ? rest : [...rest, next];
    try {
      await saveConfirms(updated.slice().sort(cmpByClass));
      setToastKind("success");
      setToast(next === null ? `${classCode} を推定値に戻しました` : `${classCode} の開始位置を指定しました`);
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    }
  };

  const firstLessonHandlers = {
    annualPlanByPack: Object.fromEntries(
      Object.entries(packs).map(([id, b]) => [id, b.annualPlan])
    ),
    packIdByClass: Object.fromEntries(progress.map((pr) => [pr.class_code, pr.pack_id])),
    confirms,
    onChange: handleFirstLessonChange,
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
        const confirm = confirms.find((c) => c.class_code === p.class_code);
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
          {/*
            持ち越しの導線（実装プラン §1.5.1）。
            確定は「予定どおり進んだ」前提でコマ数だけ進度を進めるので、
            実際より進んでしまうことがある。押した直後が気づく唯一のタイミング。
          */}
          <p className="mt-2 text-xs text-emerald-700">
            授業が予定どおり進まなかった場合は、
            <strong>翌週の「週先頭コマの確定」で本時を戻せます</strong>
            （実施累計はそのまま保たれます）。すぐ直すなら{" "}
            <Link href="/progress" className="underline">
              進度管理
            </Link>
            {" "}で完了時数を修正してください。
          </p>
        </section>
      )}

      {/* 週案グリッド */}
      {hasTimetable && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">週の授業</h2>
            {weekOverrides.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  この週の変更 {weekOverrides.length}件
                </span>
                <button
                  type="button"
                  onClick={handleClearWeek}
                  className="text-xs text-blue-600 underline hover:text-blue-800"
                >
                  すべて取り消す
                </button>
              </div>
            )}
          </div>
          <WeeklyGrid
            plan={plan}
            weekDates={weekDates}
            cancelled={cancelled}
            edit={isConfirmedWeek ? undefined : editHandlers}
            firstLesson={isConfirmedWeek ? undefined : firstLessonHandlers}
          />
          <p className="mt-2 text-xs text-slate-500">
            枠は月〜土 × 1〜6限で固定です。<strong>空きコマの「＋」から授業を追加</strong>、
            <strong>コマ左上の「×」でその時間をなくす</strong>（自分で追加したコマは取り消し、
            いつもの授業は休講）。祝日・行事で1日まるごと動くときは、日付の下の
            「この日をなくす」で理由をつけて消せます。
            <strong>休講にしたコマは打ち消し線で残り、週実施時数には数えません。</strong>
            休講カードの「↩」で元に戻せます。
            <br />
            各クラスの<strong>最初のコマ</strong>には「単元・本時」が付いています。
            前週が予定どおり進まなかったときは、そこで本時を戻してください。
          </p>
        </section>
      )}

      {/* サマリ（週案グリッドの下。まず授業の中身を見て、そのあと時数を確かめる順にする） */}
      {hasTimetable && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">週実施・実施累計</h2>
          <WeekSummaryTable summary={summary} />
        </section>
      )}

      {/* 今週を実施済みに確定（週の授業グリッドの下に置く。貼り付けると最後の曜日に重なる） */}
      {hasTimetable && plan.length > 0 && !isConfirmedWeek && (
        <section className="rounded-lg border border-blue-300 bg-blue-50 p-4">
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

/** grade_configs から `{学年}-{組}` 形式のクラスコード一覧を作る */
function listClassCodes(setting: TeacherSetting): string[] {
  const codes: string[] = [];
  for (const g of setting.grade_configs) {
    for (let i = 1; i <= g.class_count; i++) codes.push(`${g.grade}-${i}`);
  }
  return codes;
}

function cmpByClass(a: FirstLessonConfirm, b: FirstLessonConfirm): number {
  return a.class_code.localeCompare(b.class_code);
}
