"use client";

import { useState } from "react";
import { formatDate } from "@/lib/date";
import type { AnnualPlan, CancelledSlot, FirstLessonConfirm, Weekday, WeeklyPlan } from "@/types";
import AddSlotForm from "./AddSlotForm";
import FirstLessonPicker from "./FirstLessonPicker";
import LessonCard from "./LessonCard";
import SlotActionMenu, { type SlotAction } from "./SlotActionMenu";

const WEEKDAYS: readonly Weekday[] = ["月", "火", "水", "木", "金", "土"];

export type GridEditHandlers = {
  /** 選べるクラスコード（差し替え・追加の候補） */
  classCodes: string[];
  onCancelSlot: (date: string, period: number, classCode: string, reason: string) => void;
  onReplaceSlot: (
    date: string,
    period: number,
    from: string,
    to: string,
    memo: string
  ) => void;
  onAddSlot: (date: string, period: number, classCode: string, memo: string) => void;
  onCancelWholeDay: (date: string, reason: string) => void;
  /** 変更を取り消して基本時間割に戻す */
  onRestore: (date: string, period: number, classCode: string) => void;
};

export type FirstLessonHandlers = {
  /** pack_id → 年間指導計画（単元セレクトの選択肢） */
  annualPlanByPack: Record<string, AnnualPlan[]>;
  /** class_code → pack_id */
  packIdByClass: Record<string, string>;
  /** その週の確定値（無ければ推定値が使われている） */
  confirms: FirstLessonConfirm[];
  onChange: (classCode: string, next: FirstLessonConfirm | null) => void;
};

type Props = {
  plan: WeeklyPlan[];
  weekDates: Date[]; // 月〜土の6日
  /** 行事・祝日でなくなったコマ。plan とは別配列（時数に数えないため） */
  cancelled?: CancelledSlot[];
  /** 1コマのインライン編集用コールバック（メモ変更など）。null の場合は閲覧専用。 */
  onMemoChange?: (date: string, period: number, classCode: string, memo: string) => void;
  /** 時間割の変更ハンドラ。渡さなければ編集ボタンを出さない（アーカイブ表示用） */
  edit?: GridEditHandlers;
  /** 各クラスの「週の最初のコマ」で単元・本時を選ばせる。渡さなければ表示しない */
  firstLesson?: FirstLessonHandlers;
  /** 閲覧専用モード（アーカイブ表示用） */
  readOnly?: boolean;
};

/**
 * 週案の曜日別表示。
 * 月〜土の6列を横並びに、各列で当日の全コマを縦に並べる。
 *
 * **休講コマ（`cancelled`）は打ち消し線で残す。**消してしまうと
 * 「なぜ時数が減ったか」が管理職にも本人にも分からなくなるため（本人決定）。
 * ただし `plan` とは別配列なので、週実施時数には数えられない。
 */
export default function WeeklyGrid({
  plan,
  weekDates,
  cancelled = [],
  edit,
  firstLesson,
  readOnly,
}: Props) {
  /** 開いている操作パネル。`${date}:${period}:${class}` または `add:${date}` */
  const [openKey, setOpenKey] = useState<string | null>(null);

  const byDate = new Map<string, WeeklyPlan[]>();
  for (const p of plan) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.period - b.period);
  }

  const cancelledByDate = new Map<string, CancelledSlot[]>();
  for (const c of cancelled) {
    const list = cancelledByDate.get(c.date) ?? [];
    list.push(c);
    cancelledByDate.set(c.date, list);
  }

  const canEdit = Boolean(edit) && !readOnly;
  const canPickFirst = Boolean(firstLesson) && !readOnly;

  /**
   * 各クラスの「その週の最初のコマ」を特定する。
   * plan は既に日付・時限順なので、クラスごとの初出がそれにあたる。
   * 休講で月曜が消えれば火曜が最初になる（例外適用後の並びで決まる）。
   */
  const firstSlotKey = new Map<string, string>();
  for (const p of [...plan].sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)) {
    if (!firstSlotKey.has(p.class_code)) {
      firstSlotKey.set(p.class_code, `${p.date}:${p.period}:${p.class_code}`);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {weekDates.map((date, i) => {
        const dateKey = formatDate(date, "YYYY-MM-DD");
        const lessons = byDate.get(dateKey) ?? [];
        const cancels = cancelledByDate.get(dateKey) ?? [];
        const weekday = WEEKDAYS[i];
        const isEmptyDay = lessons.length === 0 && cancels.length === 0;
        const addKey = `add:${dateKey}`;

        return (
          <section
            key={dateKey}
            className={`rounded-lg border p-3 ${
              isEmptyDay ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <header className="mb-2 border-b border-slate-100 pb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  {weekday}
                  <span className="ml-1 text-xs text-slate-500">
                    {formatDate(date, "M/D")}
                  </span>
                </span>
                {lessons.length > 0 && (
                  <span className="text-xs text-slate-500">{lessons.length}コマ</span>
                )}
              </div>

              {canEdit && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenKey(openKey === addKey ? null : addKey)}
                    className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    ＋授業を追加
                  </button>
                  {lessons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const reason = window.prompt(
                          `${formatDate(date, "M/D")} の授業をすべて休講にします。\n理由を入力してください（祝日・行事など）`,
                          ""
                        );
                        if (reason === null) return;
                        edit!.onCancelWholeDay(dateKey, reason.trim());
                      }}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600 hover:bg-rose-50"
                    >
                      この日をなくす
                    </button>
                  )}
                </div>
              )}

              {canEdit && openKey === addKey && (
                <AddSlotForm
                  classCodes={edit!.classCodes}
                  onAdd={(period, classCode, memo) => {
                    edit!.onAddSlot(dateKey, period, classCode, memo);
                    setOpenKey(null);
                  }}
                  onClose={() => setOpenKey(null)}
                />
              )}
            </header>

            {isEmptyDay ? (
              <p className="text-xs text-slate-400">授業なし</p>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson) => {
                  const key = `${lesson.date}:${lesson.period}:${lesson.class_code}`;
                  return (
                    <div key={key}>
                      <LessonCard lesson={lesson} />
                      {canEdit && (
                        <div className="mt-1 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenKey(openKey === key ? null : key)}
                            className="text-xs text-slate-500 underline hover:text-slate-700"
                          >
                            変更
                          </button>
                          {lesson.is_override && (
                            <button
                              type="button"
                              onClick={() =>
                                edit!.onRestore(lesson.date, lesson.period, lesson.class_code)
                              }
                              className="text-xs text-blue-600 underline hover:text-blue-800"
                            >
                              戻す
                            </button>
                          )}
                        </div>
                      )}
                      {canPickFirst && firstSlotKey.get(lesson.class_code) === key && (
                        <FirstLessonBlock
                          lesson={lesson}
                          handlers={firstLesson!}
                          open={openKey === `first:${key}`}
                          onToggle={() =>
                            setOpenKey(openKey === `first:${key}` ? null : `first:${key}`)
                          }
                          onClose={() => setOpenKey(null)}
                        />
                      )}
                      {canEdit && openKey === key && (
                        <SlotActionMenu
                          classCode={lesson.class_code}
                          classCodes={edit!.classCodes}
                          onApply={(action: SlotAction) => {
                            if (action.type === "cancel") {
                              edit!.onCancelSlot(
                                lesson.date,
                                lesson.period,
                                lesson.class_code,
                                action.reason
                              );
                            } else {
                              edit!.onReplaceSlot(
                                lesson.date,
                                lesson.period,
                                lesson.class_code,
                                action.toClassCode,
                                action.memo
                              );
                            }
                            setOpenKey(null);
                          }}
                          onClose={() => setOpenKey(null)}
                        />
                      )}
                    </div>
                  );
                })}

                {/* 休講コマ：打ち消し線で残す。時数には数えられていない */}
                {cancels.map((c) => (
                  <div
                    key={`x:${c.date}:${c.period}:${c.class_code}`}
                    className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{c.period}限</span>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                        休講
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400 line-through">{c.class_code}</p>
                    {c.reason && (
                      <p className="mt-1 text-xs text-slate-500">{c.reason}</p>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => edit!.onRestore(c.date, c.period, c.class_code)}
                        className="mt-1.5 text-xs text-blue-600 underline hover:text-blue-800"
                      >
                        戻す
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * 「週の最初のコマ」バッジとピッカー。
 * 確定済みかどうかを一目で分かるようにし、押すと単元・本時を選べる。
 */
function FirstLessonBlock({
  lesson,
  handlers,
  open,
  onToggle,
  onClose,
}: {
  lesson: WeeklyPlan;
  handlers: FirstLessonHandlers;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const packId = handlers.packIdByClass[lesson.class_code];
  const annualPlan = handlers.annualPlanByPack[packId] ?? [];
  const confirm = handlers.confirms.find((c) => c.class_code === lesson.class_code);
  const isConfirmed = confirm !== undefined;

  return (
    <>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            isConfirmed ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
          }`}
          title={
            isConfirmed
              ? "この週の開始位置を指定済み"
              : "進度から推定した開始位置。必要なら指定できます"
          }
        >
          {isConfirmed ? "開始 指定済み" : "開始 推定"}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs text-blue-600 underline hover:text-blue-800"
        >
          単元・本時
        </button>
      </div>
      {open && (
        <FirstLessonPicker
          classCode={lesson.class_code}
          annualPlan={annualPlan}
          currentUnitName={lesson.unit_name}
          currentLessonNo={lesson.lesson_no}
          isConfirmed={isConfirmed}
          onChange={(next) => handlers.onChange(lesson.class_code, next)}
          onClose={onClose}
        />
      )}
    </>
  );
}
