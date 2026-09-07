import type { OverrideType, TimetableOverride, WeeklyPlan } from "@/types";

/**
 * 週内例外（`TimetableOverride`）を編集する純粋関数群。
 *
 * `TimetableOverride` は**基本時間割への差分**なので、
 * 取り消しは「差分を消す」だけで元に戻る。破壊的な操作にならない。
 *
 * 同じ日・時限・クラスに複数の差分ができるとマージ結果が不定になるため、
 * すべての追加操作で**既存の差分を先に取り除いてから**積む。
 */

/** 同じコマを指す差分か（cancel/replace は元クラス、add は新クラスで識別する） */
function isSameSlot(
  o: TimetableOverride,
  date: string,
  period: number,
  classCode: string
): boolean {
  if (o.date !== date || o.period !== period) return false;
  const code = o.change_type === "add" ? o.new_class_code : o.original_class_code;
  return code === classCode;
}

/** そのコマの差分を取り除く（＝元に戻す） */
export function removeOverride(
  overrides: TimetableOverride[],
  date: string,
  period: number,
  classCode: string
): TimetableOverride[] {
  return overrides.filter((o) => !isSameSlot(o, date, period, classCode));
}

/** 差分を1件積む。同じコマの既存差分は先に取り除く（二重登録の防止） */
function put(
  overrides: TimetableOverride[],
  next: TimetableOverride,
  identifyBy: string
): TimetableOverride[] {
  const cleaned = removeOverride(overrides, next.date, next.period, identifyBy);
  return [...cleaned, next].sort(
    (a, b) => a.date.localeCompare(b.date) || a.period - b.period
  );
}

/** 休講にする（行事などでコマがなくなる） */
export function cancelSlot(
  overrides: TimetableOverride[],
  date: string,
  period: number,
  classCode: string,
  reason: string
): TimetableOverride[] {
  return put(
    overrides,
    {
      date,
      period,
      original_class_code: classCode,
      new_class_code: null,
      change_type: "cancel",
      memo: reason,
    },
    classCode
  );
}

/**
 * その日のコマをまとめて休講にする（祝日・終日行事）。
 *
 * 対象は**その時点で実施予定のコマ**（＝週案に出ているコマ）。
 * すでに休講のコマは `slotsOfDay` に含まれないので二重にはならない。
 */
export function cancelWholeDay(
  overrides: TimetableOverride[],
  date: string,
  slotsOfDay: Pick<WeeklyPlan, "period" | "class_code">[],
  reason: string
): TimetableOverride[] {
  let next = overrides;
  for (const s of slotsOfDay) {
    next = cancelSlot(next, date, s.period, s.class_code, reason);
  }
  return next;
}

/** 授業を追加する（土曜授業・振替先など） */
export function addSlot(
  overrides: TimetableOverride[],
  date: string,
  period: number,
  classCode: string,
  memo: string
): TimetableOverride[] {
  return put(
    overrides,
    {
      date,
      period,
      original_class_code: null,
      new_class_code: classCode,
      change_type: "add",
      memo,
    },
    classCode
  );
}

/**
 * そのコマのクラスを差し替える。
 *
 * **2026-09-07 時点、画面からは呼ばれていない。**
 * カードを「×」だけの構成にしたため入口を廃止した（同じ枠で「×」→「＋」で
 * 別クラスを入れれば同じ結果になる）。
 * ただし `buildWeekSlots` は `replace` 型の差分を今も処理するので、
 * 過去に作られたデータは正しく表示される。関数もテストごと残しておく。
 */
export function replaceSlot(
  overrides: TimetableOverride[],
  date: string,
  period: number,
  fromClassCode: string,
  toClassCode: string,
  memo: string
): TimetableOverride[] {
  return put(
    overrides,
    {
      date,
      period,
      original_class_code: fromClassCode,
      new_class_code: toClassCode,
      change_type: "replace",
      memo,
    },
    fromClassCode
  );
}

/** その週（月〜土の日付集合）に属する差分だけ取り出す */
export function overridesInWeek(
  overrides: TimetableOverride[],
  weekDates: string[]
): TimetableOverride[] {
  const set = new Set(weekDates);
  return overrides.filter((o) => set.has(o.date));
}

/** その週の差分をまとめて取り消す */
export function clearWeekOverrides(
  overrides: TimetableOverride[],
  weekDates: string[]
): TimetableOverride[] {
  const set = new Set(weekDates);
  return overrides.filter((o) => !set.has(o.date));
}

/** 画面表示用のラベル */
export const OVERRIDE_LABELS: Record<OverrideType, string> = {
  cancel: "休講",
  replace: "クラス変更",
  add: "追加",
};
