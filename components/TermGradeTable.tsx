"use client";

import Link from "next/link";
import type { GradeLevel, GradeThreshold, StudentGrade } from "@/types";
import {
  SCORED_VIEWPOINTS,
  VIEWPOINT_LABELS,
  countGradeDistribution,
  isEnrolled,
} from "@/lib/grading";

type Props = {
  classCode: string;
  /** computeClassGrades の結果（出席番号 1..35 が全部入っている） */
  grades: StudentGrade[];
  thresholds: GradeThreshold[];
};

/**
 * 学期評定タブ（grading_design.md §5.1 タブ2）。
 *
 * 校務支援システムへの転記元になる画面なので、次の3つを守る：
 *   - 得点が1件も無い番号（在籍なし）は**行ごと出さない**。分布の分母にも入れない
 *   - **受験テスト数を並べる**。転入等で受験数が少ない児童は、少ないテストで評定が
 *     決まってしまうため、教員がその場で気づけるようにする
 *   - 閾値が**設定値**であることを画面に明示する（固定の 90/60 ではない）
 */
export default function TermGradeTable({ classCode, grades, thresholds }: Props) {
  const enrolled = grades.filter(isEnrolled);

  if (enrolled.length === 0) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        {classCode} には、この期間に集計できる得点がありません。
        期間を広げるか、「得点入力」タブで入力してください。
      </p>
    );
  }

  // 受験数の比較基準は「そのクラスで最も多く受けた児童の本数」。
  // これを下回る児童は、少ないテストで評定が決まっていることになる。
  const maxTaken = Math.max(...enrolled.map(testsTaken));

  return (
    <div className="space-y-3">
      <div className="w-fit max-w-full overflow-x-auto rounded border border-slate-200">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
              >
                番号
              </th>
              {SCORED_VIEWPOINTS.map((vp) => (
                <th
                  key={vp}
                  colSpan={2}
                  className="border-b border-l border-slate-300 px-3 py-2 text-center text-xs font-bold text-slate-700"
                >
                  {VIEWPOINT_LABELS[vp]}
                </th>
              ))}
              <th
                rowSpan={2}
                className="border-b border-l border-slate-300 px-3 py-2 text-center text-xs font-medium text-slate-600"
              >
                受験
                <br />
                テスト数
              </th>
            </tr>
            <tr className="bg-slate-50">
              {SCORED_VIEWPOINTS.map((vp) => (
                <ViewPointSubHead key={vp} />
              ))}
            </tr>
          </thead>

          <tbody>
            {enrolled.map((g) => {
              const taken = testsTaken(g);
              const few = taken < maxTaken;
              return (
                <tr key={g.student_no} className="border-b border-slate-100 bg-white">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-medium tabular-nums text-slate-500">
                    {g.student_no}
                  </td>

                  {SCORED_VIEWPOINTS.map((vp) => {
                    const r = g.by_viewpoint.find((v) => v.viewpoint === vp);
                    return (
                      <ViewPointCells
                        key={vp}
                        rate={r?.rate ?? null}
                        grade={r?.grade ?? null}
                        earned={r?.earned ?? 0}
                        max={r?.max ?? 0}
                      />
                    );
                  })}

                  <td className="border-l border-slate-200 px-3 py-1.5 text-center text-xs tabular-nums text-slate-600">
                    {taken}
                    {few && (
                      <span
                        className="ml-1 text-amber-600"
                        title={`このクラスの最多受験数（${maxTaken}）より少ないテスト数で評定が決まっています`}
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="bg-slate-50">
              <td className="sticky left-0 z-10 border-t border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                分布
              </td>
              {SCORED_VIEWPOINTS.map((vp) => {
                const dist = countGradeDistribution(grades, vp);
                return (
                  <td
                    key={vp}
                    colSpan={2}
                    className="border-t border-l border-slate-300 px-3 py-2 text-center text-xs tabular-nums text-slate-700"
                  >
                    A:{dist.A}　B:{dist.B}　C:{dist.C}
                    {dist.unjudged > 0 && (
                      <span className="ml-2 text-slate-400">判定不能:{dist.unjudged}</span>
                    )}
                  </td>
                );
              })}
              <td className="border-t border-l border-slate-300 px-3 py-2 text-center text-xs text-slate-500">
                在籍{enrolled.length}名
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        評定は観点ごとに<strong>得点率を通算</strong>（受験したテストの合計点 ÷ 合計満点）して
        判定しています。未受験は分子・分母の両方から外れます。
        閾値は現在{" "}
        {thresholds.map((t, i) => (
          <span key={t.viewpoint}>
            {i > 0 && "／"}
            {VIEWPOINT_LABELS[t.viewpoint]} A:{t.a_min}% B:{t.b_min}%
          </span>
        ))}{" "}
        です（
        <Link href="/settings" className="text-blue-600 underline">
          設定画面
        </Link>
        で変更できます）。
      </p>
    </div>
  );
}

/** その児童が受けたテスト数。観点ごとに出題の有無が違うので多いほうを採る */
function testsTaken(g: StudentGrade): number {
  return Math.max(...g.by_viewpoint.map((v) => v.test_count), 0);
}

/** 得点率・評定の2列。観点によらず同じなので観点ごとに繰り返して使う */
function ViewPointSubHead() {
  return (
    <>
      <th className="border-b border-l border-slate-300 px-3 py-1 text-center text-xs font-medium text-slate-500">
        得点率
      </th>
      <th className="border-b border-slate-200 px-3 py-1 text-center text-xs font-medium text-slate-500">
        評定
      </th>
    </>
  );
}

function ViewPointCells({
  rate,
  grade,
  earned,
  max,
}: {
  rate: number | null;
  grade: GradeLevel | null;
  earned: number;
  max: number;
}) {
  return (
    <>
      <td className="border-l border-slate-200 px-3 py-1.5 text-right tabular-nums">
        <span className="text-sm text-slate-800">{formatRate(rate)}</span>
        {max > 0 && (
          <span className="ml-1.5 text-xs text-slate-400">
            {earned}/{max}
          </span>
        )}
      </td>
      <td className="px-3 py-1.5 text-center">
        <GradeChip grade={grade} />
      </td>
    </>
  );
}

/**
 * 得点率の表示。
 *
 * **小数第1位まで出す。**整数に丸めると、たとえば真の値 89.6% が「90%」と表示されて
 * 評定は B、という食い違いが起きる（判定は丸めない生の得点率に閾値を当てているため）。
 * 通知表に載る値なので、表示と判定を食い違わせない。
 */
function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(Math.round(rate * 1000) / 10).toFixed(1)}%`;
}

const GRADE_STYLES: Record<GradeLevel, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-200",
  B: "bg-slate-100 text-slate-700 border-slate-200",
  C: "bg-amber-100 text-amber-800 border-amber-300",
};

function GradeChip({ grade }: { grade: GradeLevel | null }) {
  if (grade === null) {
    return <span className="text-xs text-slate-400" title="この観点の得点がありません">—</span>;
  }
  return (
    <span
      className={`inline-block min-w-7 rounded border px-2 py-0.5 text-xs font-bold ${GRADE_STYLES[grade]}`}
    >
      {grade}
    </span>
  );
}
