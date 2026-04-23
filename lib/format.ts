import type { WeeklyPlan } from "@/types";
import { formatDate } from "./date";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 指定日の授業一覧を LINE 向け短文に整形する。
 *
 * 例：
 *   ● 4月23日(木) の理科
 *   1限 3-1 生き物をさがそう 1/4
 *   2限 4-2 春の生き物 2/8
 *   ...
 *
 * MVP では準備物を含めない（要件定義書 § F16 / 壁打ち合意）。
 */
export function formatLessonsForLine(lessons: WeeklyPlan[], date: Date): string {
  const header = `● ${formatDate(date, "M月D日")}(${WEEKDAYS[date.getDay()]}) の理科`;

  if (lessons.length === 0) {
    return `${header}\n（今日の理科の授業はありません）`;
  }

  const sorted = [...lessons].sort((a, b) => a.period - b.period);
  const body = sorted
    .map((l) => {
      const lessonLabel =
        l.lesson_no > 0 ? `${l.lesson_no}/${l.total_hours}` : "(計画完了)";
      const unit = l.unit_name || "(未設定)";
      return `${l.period}限 ${l.class_code} ${unit} ${lessonLabel}`;
    })
    .join("\n");

  return `${header}\n${body}`;
}
