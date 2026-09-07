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
  /**
   * カードを押したときにパネルを開く。渡さなければ閲覧専用。
   *
   * バッジやリンクを**カードの外に足さない**。1コマあたり約24px 縦に伸び、
   * 7クラスぶんで画面の1/6ほどを食っていたため、
   * **色（＝面）で示し、カード自体を押させる**形にした。
   *
   * 色の優先順位は「自動でないこと」が最上位。
   *   差し替え済み（テスト・差し込み）… 黄。進度から自動で決まっていない印
   *   週の先頭コマ                    … 青。ここから週が始まる印
   *   通常                            … 白
   */
  open?: {
    onClick: () => void;
    /** そのクラスの、その週の最初のコマか */
    isFirst: boolean;
    /** 先頭コマを自分で指定済みか（false なら進度からの推定値） */
    firstConfirmed: boolean;
  };
};

/**
 * 1コマの授業カード（ホーム画面の今日カード、週案画面のコマ表示で使用）。
 * 時刻は扱わない（壁打ち合意事項E）。
 */
export default function LessonCard({
  lesson,
  compact,
  onRemove,
  removeLabel,
  open,
}: Props) {
  const isTest = lesson.kind === "test";
  // **`lesson_no === 0` だけで判定しない。**テストも 0 を使うため、
  // 種別を見ないと「年間計画完了」と誤表示する
  const isCompleted = !isTest && lesson.lesson_no === 0;
  const isUnmade =
    !isTest && (lesson.lesson_title === "(未作成)" || lesson.lesson_title === "");

  // 面の色で示す（高さは増やさない）
  let faceClass = "border-slate-200 bg-white";
  if (lesson.is_plan_override) {
    faceClass = "border-amber-400 bg-amber-50";
  } else if (open?.isFirst) {
    faceClass = `bg-blue-50 ${open.firstConfirmed ? "border-blue-500" : "border-blue-200"}`;
  }
  const openClass = open
    ? `cursor-pointer hover:brightness-95 ${faceClass}`
    : faceClass;

  const title = lesson.is_plan_override
    ? `${lesson.class_code} はこのコマだけ自分で決めています。押すと変えられます`
    : open?.isFirst
      ? `${lesson.class_code} はこの週ここから始まります。押すと変えられます`
      : `押すとこのコマの内容を変えられます`;

  return (
    <article
      className={`rounded-lg border shadow-sm ${openClass} ${
        compact ? "p-2" : "p-4 transition-shadow hover:shadow-md"
      } ${
        // 自分で追加したコマ。左端の細い線だけで示す（高さを増やさずに見分ける）。
        // 「×」の意味がこのコマだけ「追加を取り消す」に変わるため、印が要る。
        lesson.is_override ? "border-l-4 border-l-emerald-400" : ""
      }`}
      {...(open
        ? {
            role: "button" as const,
            tabIndex: 0,
            title,
            onClick: open.onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open.onClick();
              }
            },
          }
        : {})}
    >
      <div className="flex items-center justify-between">
        {onRemove ? (
          <button
            type="button"
            onClick={(e) => {
              // カード全体がクリック対象（先頭コマ）のとき、
              // 「×」を押しただけでピッカーが開かないようにする
              e.stopPropagation();
              onRemove();
            }}
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
        {!isCompleted && !isTest && (
          // 「時間目」は付けない。分数だけで伝わるうえ、
          // この3文字で折り返して1行増え、週案グリッドが縦に伸びるため
          <span className="ml-2 text-xs font-normal tabular-nums text-slate-500">
            {lesson.lesson_no}/{lesson.total_hours}
          </span>
        )}
        {isTest && (
          <span className="ml-2 rounded bg-amber-200 px-1.5 text-xs font-medium text-amber-800">
            テスト
          </span>
        )}
      </h3>

      {/* テスト名が単元名と同じときは繰り返さない（同じ語が2行並ぶだけになるため） */}
      {lesson.lesson_title && !isUnmade && lesson.lesson_title !== lesson.unit_name && (
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
