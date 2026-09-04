"use client";

type Props = {
  from: string;
  to: string;
  /** 「始業式から今日まで」に戻すときの起点 */
  startDate: string;
  onChange: (next: { from: string; to: string }) => void;
};

/**
 * 集計期間の指定（grading_design.md §5.3）。
 *
 * 学期の区切りは 2学期制／3学期制で学校差があるため、
 * **設定には持たせず、集計画面で日付範囲を直接指定する**。
 * プリセット（前期／後期）は運用しながら必要になった時点で足す。
 */
export default function PeriodPicker({ from, to, startDate, onChange }: Props) {
  const invalid = from !== "" && to !== "" && from > to;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="period-from"
            className="mb-1 block text-xs font-medium text-slate-600"
          >
            集計期間
          </label>
          <div className="flex items-center gap-2">
            <input
              id="period-from"
              type="date"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-slate-500">〜</span>
            <input
              type="date"
              value={to}
              aria-label="集計期間の終了日"
              onChange={(e) => onChange({ from, to: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange({ from: startDate, to: todayString() })}
          className="min-h-9 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          始業式から今日まで
        </button>
      </div>

      {invalid ? (
        <p className="mt-2 text-xs text-rose-600">
          開始日が終了日より後になっています。集計結果は空になります。
        </p>
      ) : (
        <p className="mt-2 text-xs text-slate-500">
          テストの<strong>実施日</strong>がこの範囲に入るものだけを通算します。
        </p>
      )}
    </section>
  );
}

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}
