import type { WeeklyPlan } from "@/types";

type Props = {
  /** 表示中の週の授業（休講は含まれない） */
  plan: WeeklyPlan[];
  /** class_code → いつもの週の時数（基本時間割から算出） */
  standardHours: Record<string, number>;
  /** 並び順。設定の学年構成から作った順に出す */
  classCodes: string[];
};

/**
 * 週案グリッドの上に置く、クラス別の「予定 / 基準」の帯。
 *
 * **編集しながらつねに見えることが要件。**下の時数表は
 * 「週実施」＝確定した週だけを数えるので、いま組んでいる週は 0 のまま。
 * 組み立て中に「3-1 は何コマ入れたか」を見る場所が無かった。
 *
 * 高さを増やさないため、表ではなく**1行に並べたチップ**にし、
 * 過不足は文字ではなく**色（面）**で示す。
 * 祝日で「この日をなくす」をした週は、その日のクラスが軒並み黄色になる。
 * これは正しい表示で、振替が要るクラスがその場で分かる。
 */
export default function WeekPlanStrip({ plan, standardHours, classCodes }: Props) {
  if (classCodes.length === 0) return null;

  const planned: Record<string, number> = {};
  for (const p of plan) {
    planned[p.class_code] = (planned[p.class_code] ?? 0) + 1;
  }

  let totalPlanned = 0;
  let totalStandard = 0;
  for (const code of classCodes) {
    totalPlanned += planned[code] ?? 0;
    totalStandard += standardHours[code] ?? 0;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs font-medium text-slate-600">週の予定</span>

      {classCodes.map((code) => {
        const n = planned[code] ?? 0;
        const std = standardHours[code] ?? 0;
        // 基準どおりは灰、足りないときだけ黄、多いときは青。
        // 「足りない」が一番大事な情報なので、そこだけ目に入るようにする
        const tone =
          std === 0 || n === std
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : n < std
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-blue-300 bg-blue-50 text-blue-700";
        return (
          <span
            key={code}
            className={`rounded border px-1.5 py-0.5 text-xs tabular-nums ${tone}`}
            title={
              std === 0
                ? `${code} は基本時間割に入っていません`
                : n === std
                  ? `${code} はいつもどおり ${std} コマです`
                  : n < std
                    ? `${code} はいつもより ${std - n} コマ少ない予定です`
                    : `${code} はいつもより ${n - std} コマ多い予定です`
            }
          >
            <span className="font-medium">{code}</span>{" "}
            <span className="font-bold">{n}</span>
            <span className="text-slate-400">/{std}</span>
          </span>
        );
      })}

      <span className="ml-auto text-xs tabular-nums text-slate-600">
        計 <span className="font-bold">{totalPlanned}</span>
        <span className="text-slate-400">/{totalStandard}</span>
      </span>
    </div>
  );
}
