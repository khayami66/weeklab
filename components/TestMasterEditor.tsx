"use client";

import { useMemo } from "react";
import type { GradeConfig, TestMaster } from "@/types";

type Props = {
  testMasters: TestMaster[];
  gradeConfigs: GradeConfig[];
  /** pack_id → その学年の単元名一覧（年間指導計画由来） */
  unitsByPack: Record<string, string[]>;
  /** pack_id → 表示名（"3年 / 啓林館 理科" など） */
  packLabels: Record<string, string>;
  onChange: (next: TestMaster[]) => void;
};

/**
 * 業者単元テストの定義を編集する UI。
 *
 * 手元のテスト冊子を見ながら、単元ごとに観点別の満点を入れるだけ。
 * 満点 0 は「その観点の出題なし」を意味し、集計から自動的に外れる。
 *
 * **単元は任意**。「1学期のまとめ」のように複数の単元にまたがるテストがあるため、
 * 単元に紐づけずに登録できる。無理に近い単元を選ばせると、
 * 将来の「配当時数 × 単元ごとの結果」の突合で誤った対応づけが生まれる。
 *
 * 学年構成から消えたパックのテストも**削除しない**。
 * 得点データ（TestResult）が test_id で紐づいており、
 * マスタを消すと過去の得点が集計不能になるため、警告の表示にとどめる。
 */
export default function TestMasterEditor({
  testMasters,
  gradeConfigs,
  unitsByPack,
  packLabels,
  onChange,
}: Props) {
  const activePackIds = useMemo(
    () => [...new Set(gradeConfigs.map((g) => g.pack_id).filter((id) => id !== ""))],
    [gradeConfigs]
  );

  const stale = testMasters.filter((m) => !activePackIds.includes(m.pack_id));

  const update = (index: number, patch: Partial<TestMaster>) => {
    const next = testMasters.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const add = () => {
    const packId = activePackIds[0] ?? "";
    onChange([
      ...testMasters,
      {
        test_id: newTestId(packId, testMasters),
        pack_id: packId,
        unit_name: "",
        test_name: "",
        max_knowledge: 0,
        max_thinking: 0,
        note: "",
      },
    ]);
  };

  const remove = (index: number) => {
    const target = testMasters[index];
    const ok = confirm(
      `「${target.test_name || "(名称未設定)"}」を削除します。\n\n` +
        "このテストで入力済みの得点があると集計できなくなります。\n実行してよろしいですか？"
    );
    if (!ok) return;
    onChange(testMasters.filter((_, i) => i !== index));
  };

  if (activePackIds.length === 0) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        先に「学年構成」で学年と使用パックを設定してください。
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {stale.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          担当から外れた学年のテストが {stale.length} 件あります。入力済みの得点を
          守るため自動削除はしていません。不要であれば個別に削除してください。
        </p>
      )}

      {testMasters.length === 0 && (
        <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          テストが登録されていません。「テストを追加」から、手元のテスト冊子の
          単元名と観点別の満点を登録してください。
        </p>
      )}

      {testMasters.map((m, index) => {
        const units = unitsByPack[m.pack_id] ?? [];
        const unitMissing = m.unit_name !== "" && !units.includes(m.unit_name);
        const noMax = m.max_knowledge === 0 && m.max_thinking === 0;
        return (
          <div
            key={m.test_id}
            className="grid gap-3 rounded border border-slate-200 p-4 md:grid-cols-[150px_1fr_1fr_110px_110px_auto]"
          >
            <Field label="学年・パック">
              <select
                value={m.pack_id}
                onChange={(e) =>
                  update(index, { pack_id: e.target.value, unit_name: "" })
                }
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {activePackIds.map((id) => (
                  <option key={id} value={id}>
                    {packLabels[id] ?? id}
                  </option>
                ))}
                {!activePackIds.includes(m.pack_id) && (
                  <option value={m.pack_id}>{packLabels[m.pack_id] ?? m.pack_id}（担当外）</option>
                )}
              </select>
            </Field>

            <Field label="単元">
              <select
                value={m.unit_name}
                onChange={(e) => {
                  const unit_name = e.target.value;
                  // テスト名が未入力なら単元名を初期値に入れる
                  const test_name = m.test_name === "" ? unit_name : m.test_name;
                  update(index, { unit_name, test_name });
                }}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">（単元に紐づけない）</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                {unitMissing && <option value={m.unit_name}>{m.unit_name}（現行計画になし）</option>}
              </select>
              {unitMissing && (
                <p className="mt-1 text-xs text-amber-600">年間指導計画に無い単元名です</p>
              )}
            </Field>

            <Field label="テスト名">
              <input
                type="text"
                value={m.test_name}
                onChange={(e) => update(index, { test_name: e.target.value })}
                placeholder="例：風とゴムの力のはたらき"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </Field>

            <Field label="知識・技能">
              <MaxInput
                value={m.max_knowledge}
                invalid={noMax}
                ariaLabel={`${m.test_name || "テスト"} の知識・技能の満点`}
                onChange={(max_knowledge) => update(index, { max_knowledge })}
              />
            </Field>

            <Field label="思考・判断・表現">
              <MaxInput
                value={m.max_thinking}
                invalid={noMax}
                ariaLabel={`${m.test_name || "テスト"} の思考・判断・表現の満点`}
                onChange={(max_thinking) => update(index, { max_thinking })}
              />
            </Field>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => remove(index)}
                className="rounded border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                aria-label={`${m.test_name || "テスト"}を削除`}
              >
                削除
              </button>
            </div>

            <p className="col-span-full text-xs text-slate-500">
              {noMax ? (
                <span className="text-rose-600">
                  どちらかの観点に満点を入力してください（0 は「出題なし」の意味です）
                </span>
              ) : (
                <>
                  満点 0 の観点は「そのテストでは出題なし」として集計から外れます。
                  {m.unit_name === "" &&
                    "／単元なしで登録されています（1学期のまとめなど、複数単元にまたがるテスト向け）"}
                </>
              )}
            </p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        ＋ テストを追加
      </button>
    </div>
  );
}

type MaxInputProps = {
  value: number;
  invalid: boolean;
  ariaLabel: string;
  onChange: (value: number) => void;
};

function MaxInput({ value, invalid, ariaLabel, onChange }: MaxInputProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clampMax(Number(e.target.value)))}
        min={0}
        max={200}
        className={`w-16 rounded border px-2 py-1.5 text-sm focus:outline-none ${
          invalid
            ? "border-rose-400 focus:border-rose-500"
            : "border-slate-300 focus:border-blue-500"
        }`}
      />
      <span className="text-xs text-slate-500">点</span>
    </span>
  );
}

function clampMax(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(200, Math.round(n)));
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/**
 * test_id を発番する。
 *
 * 得点データ（TestResult）がこの ID で紐づくため、**一度決めたら変えない**。
 * 単元名から作ると単元名の修正で ID が変わってしまうので、乱数を使う。
 */
function newTestId(packId: string, existing: TestMaster[]): string {
  const used = new Set(existing.map((m) => m.test_id));
  for (let i = 0; i < 100; i++) {
    const id = `${packId}.t${Math.random().toString(36).slice(2, 8)}`;
    if (!used.has(id)) return id;
  }
  return `${packId}.t${Date.now().toString(36)}`;
}
