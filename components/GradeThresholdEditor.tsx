"use client";

import type { GradeThreshold, ViewPoint } from "@/types";
import {
  DEFAULT_A_MIN,
  DEFAULT_B_MIN,
  SCORED_VIEWPOINTS,
  VIEWPOINT_LABELS,
  defaultThresholds,
} from "@/lib/grading";

type Props = {
  thresholds: GradeThreshold[];
  onChange: (next: GradeThreshold[]) => void;
};

/**
 * 評定（A/B/C）の閾値を観点ごとに編集する UI。
 *
 * A の下限以上が A、B の下限以上が B、それ未満が C。
 * 初期値は全観点 90/60 だが固定値ではなく、
 * 学期評定の分布を見てから調整することを想定している。
 */
export default function GradeThresholdEditor({ thresholds, onChange }: Props) {
  const find = (vp: ViewPoint): GradeThreshold =>
    thresholds.find((t) => t.viewpoint === vp) ?? {
      viewpoint: vp,
      a_min: DEFAULT_A_MIN,
      b_min: DEFAULT_B_MIN,
    };

  const update = (vp: ViewPoint, patch: Partial<GradeThreshold>) => {
    const next = SCORED_VIEWPOINTS.map((v) =>
      v === vp ? { ...find(v), ...patch } : find(v)
    );
    onChange(next);
  };

  const isDefault =
    JSON.stringify(SCORED_VIEWPOINTS.map(find)) === JSON.stringify(defaultThresholds());

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-600">
              <th className="py-2 pr-4 font-medium">観点</th>
              <th className="py-2 pr-4 font-medium">A の下限</th>
              <th className="py-2 pr-4 font-medium">B の下限</th>
              <th className="py-2 font-medium">判定</th>
            </tr>
          </thead>
          <tbody>
            {SCORED_VIEWPOINTS.map((vp) => {
              const t = find(vp);
              const invalid = t.b_min > t.a_min;
              return (
                <tr key={vp} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium text-slate-700">
                    {VIEWPOINT_LABELS[vp]}
                  </td>
                  <td className="py-3 pr-4">
                    <PercentInput
                      value={t.a_min}
                      invalid={invalid}
                      onChange={(a_min) => update(vp, { a_min })}
                      ariaLabel={`${VIEWPOINT_LABELS[vp]} の A の下限`}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <PercentInput
                      value={t.b_min}
                      invalid={invalid}
                      onChange={(b_min) => update(vp, { b_min })}
                      ariaLabel={`${VIEWPOINT_LABELS[vp]} の B の下限`}
                    />
                  </td>
                  <td className="py-3 text-xs text-slate-500">
                    {invalid ? (
                      <span className="text-rose-600">
                        B の下限が A の下限を超えています
                      </span>
                    ) : (
                      <>
                        {t.a_min}% 以上 = A ／ {t.b_min}% 以上 = B ／ それ未満 = C
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-500">
          学期評定は「合計得点 ÷ 合計満点」の通算得点率で判定します。
          分布を見てから調整できるよう、ここで変更できるようにしています。
        </p>
        <button
          type="button"
          onClick={() => onChange(defaultThresholds())}
          disabled={isDefault}
          className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          既定値（{DEFAULT_A_MIN}/{DEFAULT_B_MIN}）に戻す
        </button>
      </div>
    </div>
  );
}

type PercentInputProps = {
  value: number;
  invalid: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
};

function PercentInput({ value, invalid, ariaLabel, onChange }: PercentInputProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampPercent(Number(e.target.value)))}
        min={0}
        max={100}
        className={`w-20 rounded border px-2 py-1.5 text-sm focus:outline-none ${
          invalid
            ? "border-rose-400 focus:border-rose-500"
            : "border-slate-300 focus:border-blue-500"
        }`}
      />
      <span className="text-xs text-slate-500">%</span>
    </span>
  );
}

function clampPercent(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
