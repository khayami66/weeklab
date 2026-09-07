import type { SlotPlanOverride } from "@/types";

/**
 * コマの**中身**の差し替え（テスト・別単元の差し込み）を編集する純粋関数群。
 *
 * コマの**有無**を変える `overrideEdit.ts`（休講・追加・クラス変更）とは
 * 別の軸なので、配列も関数も分けている。混ぜると
 * 「休講にしたコマにテストが残る」ような矛盾が起きる。
 *
 * 1コマ（日付 × 時限 × クラス）につき1件。同じコマを2回指定したら上書きする。
 */

/** 1コマを一意に指す文字列 */
export function slotPlanKey(date: string, period: number, classCode: string): string {
  return `${date}:${period}:${classCode}`;
}

/** そのコマの差し替えを探す。無ければ null（＝進度からの自動計算） */
export function findSlotPlan(
  plans: SlotPlanOverride[],
  date: string,
  period: number,
  classCode: string
): SlotPlanOverride | null {
  const key = slotPlanKey(date, period, classCode);
  return (
    plans.find((p) => slotPlanKey(p.date, p.period, p.class_code) === key) ?? null
  );
}

/** 差し替えを登録する（同じコマの既存分は置き換える） */
export function setSlotPlan(
  plans: SlotPlanOverride[],
  next: SlotPlanOverride
): SlotPlanOverride[] {
  const key = slotPlanKey(next.date, next.period, next.class_code);
  const rest = plans.filter((p) => slotPlanKey(p.date, p.period, p.class_code) !== key);
  return [...rest, next];
}

/** 差し替えを取り消して、進度からの自動計算に戻す */
export function clearSlotPlan(
  plans: SlotPlanOverride[],
  date: string,
  period: number,
  classCode: string
): SlotPlanOverride[] {
  const key = slotPlanKey(date, period, classCode);
  return plans.filter((p) => slotPlanKey(p.date, p.period, p.class_code) !== key);
}

/** その週（日付の集合）に含まれる差し替えだけを返す */
export function slotPlansInWeek(
  plans: SlotPlanOverride[],
  dateKeys: string[]
): SlotPlanOverride[] {
  const set = new Set(dateKeys);
  return plans.filter((p) => set.has(p.date));
}

/**
 * その週の差し替えをまとめて取り消す。
 * 「今週の変更をなかったことにする」導線で使う。
 */
export function clearSlotPlansInWeek(
  plans: SlotPlanOverride[],
  dateKeys: string[]
): SlotPlanOverride[] {
  const set = new Set(dateKeys);
  return plans.filter((p) => !set.has(p.date));
}
