"use client";

import type { LessonPlan } from "@/types";

type Props = {
  unitName: string;
  /** 単元の配当時数ぶんの行（buildPlanRows の結果） */
  rows: LessonPlan[];
  onChange: (lessonNo: number, patch: Partial<LessonPlan>) => void;
};

/**
 * 授業案の編集表（1単元ぶん）。
 *
 * 行数は単元の配当時数で決まる。1時間目から順に、
 * **週案の1セルに収まる1〜2行**を書く。
 * AI との壁打ちで作った内容を貼り付けて使うことを想定しているので、
 * 貼り付けやすさ（複数行を受けられる textarea）とキーボード移動を優先している。
 */
export default function LessonPlanEditor({ unitName, rows, onChange }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        「{unitName}」は年間指導計画に配当時数がないため、授業案の行を作れません。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const filled = row.lesson_title.trim() !== "" || row.content.trim() !== "";
        return (
          <div
            key={row.lesson_no}
            className={`grid gap-3 rounded border p-4 md:grid-cols-[90px_1fr_2fr] ${
              filled ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50"
            }`}
          >
            <div className="flex items-center">
              <span className="text-sm font-medium tabular-nums text-slate-700">
                {row.lesson_no}
                <span className="text-xs font-normal text-slate-400">
                  /{rows.length}時間目
                </span>
              </span>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                本時のタイトル
              </span>
              <input
                type="text"
                value={row.lesson_title}
                onChange={(e) => onChange(row.lesson_no, { lesson_title: e.target.value })}
                placeholder="例：ゴムの力で車を走らせる"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                授業内容（週案に印刷されます）
              </span>
              <textarea
                value={row.content}
                onChange={(e) => onChange(row.lesson_no, { content: e.target.value })}
                rows={2}
                placeholder="例：ゴムの伸ばし方を変えて距離を比べる。班ごとに記録用紙へ。"
                className="w-full resize-y rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
        );
      })}

      <p className="text-xs text-slate-500">
        タイトルと内容が<strong>どちらも空の時間は保存されません</strong>
        （空欄のままにしておけば、あとから書き足せます）。
        内容は週案の1コマに表示・印刷されるので、1〜2行に収めてください。
      </p>
    </div>
  );
}
