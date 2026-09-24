import type { WeeklyPlan } from "@/types";

type Props = {
  /** 表示中の週の授業（なくしたコマは含まれない） */
  plan: WeeklyPlan[];
  /** 並び順。設定の学年構成から作った順に出す */
  classCodes: string[];
};

/**
 * 週案グリッドの上に置く、クラス別の予定コマ数。
 *
 * **編集しながらつねに見えることが要件。**下の時数表は
 * 「週実施」＝確定した週だけを数えるので、いま組んでいる週は 0 のまま。
 * 組み立て中に「3-1 は何コマ入れたか」を見る場所が無かった。
 *
 * 基準との分数や色分けは置かない。祝日の多い週は全クラスが基準割れするので
 * 帯が一面色づいて読みにくく、数字も倍に増える（本人決定 2026-09-24）。
 * 何コマ入っているかが一目で分かれば足りる。
 */
export default function WeekPlanStrip({ plan, classCodes }: Props) {
  if (classCodes.length === 0) return null;

  const planned: Record<string, number> = {};
  for (const p of plan) {
    planned[p.class_code] = (planned[p.class_code] ?? 0) + 1;
  }
  const total = classCodes.reduce((s, code) => s + (planned[code] ?? 0), 0);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-medium text-slate-600">週の予定</span>

      {classCodes.map((code) => (
        <span key={code} className="text-xs tabular-nums text-slate-600">
          {code} <span className="font-bold text-slate-800">{planned[code] ?? 0}</span>
        </span>
      ))}

      <span className="ml-auto text-xs tabular-nums text-slate-600">
        計 <span className="font-bold text-slate-800">{total}</span>
      </span>
    </div>
  );
}
