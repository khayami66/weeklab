"use client";

import { useState } from "react";
import { formatDate } from "@/lib/date";
import type {
  AnnualPlan,
  CancelledSlot,
  FirstLessonConfirm,
  Weekday,
  WeeklyPlan,
} from "@/types";
import AddSlotForm from "./AddSlotForm";
import FirstLessonPicker from "./FirstLessonPicker";
import LessonCard from "./LessonCard";

const WEEKDAYS: readonly Weekday[] = ["月", "火", "水", "木", "金", "土"];

/** 時限。基本時間割エディタと同じ 1〜6 限で固定 */
const PERIODS = [1, 2, 3, 4, 5, 6];

export type GridEditHandlers = {
  /** 選べるクラスコード（差し替え・追加の候補） */
  classCodes: string[];
  /**
   * 個別のコマを休講にする。**理由は聞かない。**
   * 1コマずつ理由を入力させると、行事の週は5〜6回ダイアログが出て
   * 週案作成が速くなるどころか遅くなるため（理由は「この日をなくす」でのみ聞く）。
   */
  onCancelSlot: (date: string, period: number, classCode: string) => void;
  onAddSlot: (date: string, period: number, classCode: string, memo: string) => void;
  onCancelWholeDay: (date: string, reason: string) => void;
  /** 差分を取り消して基本時間割に戻す（休講の解除・追加の取り消し） */
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
 * 週案の表示。**月〜土 × 1〜6限のマトリクスで枠を固定する。**
 *
 * 以前は日ごとに「あるコマだけ」を縦に積んでいたため、
 * 2限と4限の授業が隣り合って見え、**空き時間が読み取れなかった**。
 * 枠を固定すると「1限は空き、2限に3-1、3限は空き」が一目で分かる。
 *
 * この形は印刷様式（Y案：月〜土 × 時限のグリッド）とも一致するので、
 * 週案印刷（Phase 13）でそのまま流用できる。
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
  /** 開いているパネル。`slot:${key}` / `first:${key}` / `add:${date}:${period}` */
  const [openKey, setOpenKey] = useState<string | null>(null);

  const canEdit = Boolean(edit) && !readOnly;
  const canPickFirst = Boolean(firstLesson) && !readOnly;

  /** `${date}:${period}` → その枠の授業 */
  const byCell = new Map<string, WeeklyPlan[]>();
  for (const p of plan) {
    const k = `${p.date}:${p.period}`;
    const list = byCell.get(k) ?? [];
    list.push(p);
    byCell.set(k, list);
  }

  /** `${date}:${period}` → その枠の休講 */
  const cancelledByCell = new Map<string, CancelledSlot[]>();
  for (const c of cancelled) {
    const k = `${c.date}:${c.period}`;
    const list = cancelledByCell.get(k) ?? [];
    list.push(c);
    cancelledByCell.set(k, list);
  }

  const countByDate = new Map<string, number>();
  for (const p of plan) {
    countByDate.set(p.date, (countByDate.get(p.date) ?? 0) + 1);
  }

  /**
   * 各クラスの「その週の最初のコマ」を特定する。
   * 日付・時限順に走査したときのクラスごとの初出。
   * 休講で月曜が消えれば火曜が最初になる（例外適用後の並びで決まる）。
   */
  const firstSlotKey = new Map<string, string>();
  for (const p of [...plan].sort(
    (a, b) => a.date.localeCompare(b.date) || a.period - b.period
  )) {
    if (!firstSlotKey.has(p.class_code)) {
      firstSlotKey.set(p.class_code, `${p.date}:${p.period}:${p.class_code}`);
    }
  }

  const dateKeys = weekDates.map((d) => formatDate(d, "YYYY-MM-DD"));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-[56px_repeat(6,minmax(0,1fr))] gap-2">
          <div />
          {weekDates.map((date, i) => {
            const dateKey = dateKeys[i];
            const count = countByDate.get(dateKey) ?? 0;
            return (
              <div
                key={dateKey}
                className="rounded-t-lg border-b-2 border-slate-200 bg-white px-2 py-1.5"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    {WEEKDAYS[i]}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      {formatDate(date, "M/D")}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {count > 0 ? `${count}コマ` : "—"}
                  </span>
                </div>
                {canEdit && count > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const reason = window.prompt(
                        `${formatDate(date, "M/D")} の授業をすべて休講にします。理由を入力してください（祝日・行事など）`,
                        ""
                      );
                      if (reason === null) return;
                      edit!.onCancelWholeDay(dateKey, reason.trim());
                    }}
                    className="mt-1 text-xs text-slate-500 underline hover:text-rose-600"
                  >
                    この日をなくす
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* 時限 × 曜日 */}
        {PERIODS.map((period) => (
          <div
            key={period}
            className="grid grid-cols-[56px_repeat(6,minmax(0,1fr))] items-stretch gap-2 border-b border-slate-100 py-2"
          >
            <div className="flex items-start justify-end pr-1 pt-2">
              <span className="text-xs font-medium tabular-nums text-slate-500">
                {period}限
              </span>
            </div>

            {dateKeys.map((dateKey) => {
              const cellKey = `${dateKey}:${period}`;
              const lessons = byCell.get(cellKey) ?? [];
              const cancels = cancelledByCell.get(cellKey) ?? [];
              const addKey = `add:${cellKey}`;
              const isEmpty = lessons.length === 0 && cancels.length === 0;

              return (
                <div key={cellKey} className="min-w-0">
                  {isEmpty ? (
                    canEdit ? (
                      /*
                        開いたらボタンと入れ替える（並べない）。
                        「＋」は h-full で枠いっぱいに伸びるため、下にフォームを足すと
                        ボタンが伸びたぶんフォームが画面外へ押し出される。
                      */
                      openKey === addKey ? (
                        <AddSlotForm
                          classCodes={edit!.classCodes}
                          fixedPeriod={period}
                          onAdd={(p, classCode, memo) => {
                            edit!.onAddSlot(dateKey, p, classCode, memo);
                            setOpenKey(null);
                          }}
                          onClose={() => setOpenKey(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpenKey(addKey)}
                          className="h-full min-h-16 w-full rounded-lg border border-dashed border-slate-200 text-xs text-slate-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600"
                          title={`${dateKey} ${period}限に授業を追加`}
                        >
                          ＋
                        </button>
                      )
                    ) : (
                      <div className="h-full min-h-16 rounded-lg border border-dashed border-slate-100" />
                    )
                  ) : (
                    <div className="space-y-2">
                      {lessons.map((lesson) => {
                        const key = `${lesson.date}:${lesson.period}:${lesson.class_code}`;
                        return (
                          <div key={key}>
                            <LessonCard
                              lesson={lesson}
                              compact
                              onRemove={
                                canEdit
                                  ? () => {
                                      // 自分で追加したコマは「休講」にせず追加そのものを取り消す。
                                      // もともと無かったコマを打ち消し線で残す意味がないため。
                                      if (lesson.is_override) {
                                        edit!.onRestore(
                                          lesson.date,
                                          lesson.period,
                                          lesson.class_code
                                        );
                                      } else {
                                        edit!.onCancelSlot(
                                          lesson.date,
                                          lesson.period,
                                          lesson.class_code
                                        );
                                      }
                                    }
                                  : undefined
                              }
                              removeLabel={
                                lesson.is_override
                                  ? "追加したこのコマを取り消す"
                                  : "この時間を休講にする"
                              }
                            />
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
                          </div>
                        );
                      })}

                      {/* 休講：打ち消し線で残す。時数には数えられていない */}
                      {cancels.map((c) => (
                        <div
                          key={`x:${c.date}:${c.period}:${c.class_code}`}
                          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2"
                        >
                          <div className="flex items-center justify-between">
                            {/*
                              授業カードの「×」と同じ位置に置く。
                              同じ場所を押せば「消す ⇄ 戻す」が行き来できる。
                            */}
                            {canEdit ? (
                              <button
                                type="button"
                                onClick={() => edit!.onRestore(c.date, c.period, c.class_code)}
                                aria-label="休講を取り消して元に戻す"
                                title="休講を取り消して元に戻す"
                                className="-ml-1 -mt-1 rounded px-1.5 text-sm leading-none text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              >
                                ↩
                              </button>
                            ) : (
                              <span />
                            )}
                            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                              休講
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-400 line-through">
                            {c.class_code}
                          </p>
                          {c.reason && (
                            <p className="mt-0.5 text-xs text-slate-500">{c.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
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
      <div className="mt-1 flex flex-wrap items-center gap-2">
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
