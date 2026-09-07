import type { WeeklyPlan } from "@/types";

type Props = {
  lesson: WeeklyPlan;
  /**
   * 週案グリッド（時限×曜日のマトリクス）用の詰めた表示。
   * 時限は行見出しに出ているのでカードからは省き、余白と文字を小さくする。
   */
  compact?: boolean;
  /**
   * 左上に「×」を出す。押すとこの時間をなくす。
   *
   * カードの**下**にリンクを並べると1コマあたり約20px 縦に伸び、
   * 6日×最大6限の枠では画面1つぶん近いスクロールになる。
   * カード内の余白に収める。
   */
  onRemove?: () => void;
  /** 「×」の説明（休講にする／追加を取り消す、で意味が変わる） */
  removeLabel?: string;
};

/**
 * 1コマの授業カード（ホーム画面の今日カード、週案画面のコマ表示で使用）。
 * 時刻は扱わない（壁打ち合意事項E）。
 */
export default function LessonCard({ lesson, compact, onRemove, removeLabel }: Props) {
  const isCompleted = lesson.lesson_no === 0; // 年間計画完遂
  const isUnmade = lesson.lesson_title === "(未作成)" || lesson.lesson_title === "";

  return (
    <article
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${
        compact ? "p-2" : "p-4 transition-shadow hover:shadow-md"
      } ${
        // 自分で追加したコマ。左端の細い線だけで示す（高さを増やさずに見分ける）。
        // 「×」の意味がこのコマだけ「追加を取り消す」に変わるため、印が要る。
        lesson.is_override ? "border-l-4 border-l-emerald-400" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel ?? "この時間をなくす"}
            title={removeLabel ?? "この時間をなくす"}
            className="-ml-1 -mt-1 rounded px-1.5 text-sm leading-none text-slate-300 hover:bg-rose-50 hover:text-rose-600"
          >
            ×
          </button>
        ) : compact ? (
          <span />
        ) : (
          <span className="text-xs text-slate-500">{lesson.period}限</span>
        )}
        <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
          {lesson.class_code}
        </span>
      </div>

      <h3 className={compact ? "mt-1 text-sm font-semibold text-slate-800" : "mt-2 text-base font-semibold text-slate-800"}>
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
        <p className={`line-clamp-2 text-slate-600 ${compact ? "mt-1 text-xs" : "mt-2 text-sm"}`}>
          {lesson.content}
        </p>
      )}

      <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-1.5" : "mt-3 gap-2"}`}>
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
