import type { WeeklyPlan } from "@/types";

type Props = {
  lesson: WeeklyPlan;
};

/**
 * 1コマの授業カード（ホーム画面の今日カード、週案画面のコマ表示で使用）。
 * 時刻は扱わない（壁打ち合意事項E）。
 */
export default function LessonCard({ lesson }: Props) {
  const isCompleted = lesson.lesson_no === 0; // 年間計画完遂
  const isUnmade = lesson.lesson_title === "(未作成)" || lesson.lesson_title === "";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{lesson.period}限</span>
        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
          {lesson.class_code}
        </span>
      </div>

      <h3 className="mt-2 text-base font-semibold text-slate-800">
        {lesson.unit_name || "(未設定)"}
        {!isCompleted && (
          <span className="ml-2 text-xs font-normal text-slate-500">
            {lesson.lesson_no}/{lesson.total_hours}時間目
          </span>
        )}
      </h3>

      {lesson.lesson_title && !isUnmade && (
        <p className="mt-1 text-sm font-medium text-slate-700">{lesson.lesson_title}</p>
      )}

      {lesson.content && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{lesson.content}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lesson.is_override && (
          <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            変更
          </span>
        )}
        {isUnmade && !isCompleted && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            授業内容未記入
          </span>
        )}
        {isCompleted && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            年間計画完了
          </span>
        )}
      </div>
    </article>
  );
}
