"use client";

import type { AnnualPlan, SlotPlanOverride, TestMaster } from "@/types";

/** 呼び出し側が日付・時限・クラスを足して `SlotPlanOverride` にする */
export type SlotPlanChoice =
  | { kind: "test"; test_id: string }
  | { kind: "lesson"; unit_name: string; lesson_no: number };

type Props = {
  classCode: string;
  /** そのクラスの年間指導計画（単元の選択肢） */
  annualPlan: AnnualPlan[];
  /** そのクラスの学年のテスト（テストの選択肢） */
  testMasters: TestMaster[];
  /** いま入っている差し替え。null なら自動計算のまま */
  current: SlotPlanOverride | null;
  /** 差し替えが無いときにこのコマに出る単元・本時（説明に使う） */
  autoUnitName: string;
  autoLessonNo: number;
  onChange: (next: SlotPlanChoice | null) => void;
  onClose: () => void;
};

/**
 * 「このコマで何をするか」を選ぶ。
 *
 * **週の先頭コマの `FirstLessonPicker` とは意味がまったく違う。**
 *   先頭コマ … 「このクラスは今ここにいる」と現在地を宣言する（以降ずっと影響する）
 *   ここ     … 「このコマだけ別のことをする」（進度は動かない。1コマで閉じる）
 *
 * 差し替えたコマは単元の残り時間を消費しないので、次のコマは自動で
 * もとの単元の続きに戻る。**テストのために先頭コマを触る必要はない。**
 *
 * 変更は即時保存する（時間割の変更・先頭コマと同じ挙動にそろえる）。
 */
export default function SlotPlanPicker({
  classCode,
  annualPlan,
  testMasters,
  current,
  autoUnitName,
  autoLessonNo,
  onChange,
  onClose,
}: Props) {
  const mode: "auto" | "test" | "lesson" = current?.kind ?? "auto";

  const selectedUnitName = current?.kind === "lesson" ? current.unit_name : autoUnitName;
  const selectedUnit = annualPlan.find((p) => p.unit_name === selectedUnitName);
  const lessonOptions = selectedUnit
    ? Array.from({ length: selectedUnit.allocated_hours }, (_, i) => i + 1)
    : [];

  const tabClass = (active: boolean) =>
    `flex-1 rounded px-2 py-1.5 text-xs font-medium ${
      active
        ? "bg-emerald-600 text-white"
        : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  return (
    <div className="mt-2 space-y-2 rounded border border-emerald-300 bg-emerald-50 p-2">
      <p className="text-xs font-medium text-slate-700">
        {classCode} このコマで何をしますか
      </p>

      <div className="flex gap-1.5">
        <button type="button" onClick={() => onChange(null)} className={tabClass(mode === "auto")}>
          自動
        </button>
        <button
          type="button"
          // 未選択でも「テスト」として入れられる（テストマスタ未登録でも止まらない）
          onClick={() => onChange({ kind: "test", test_id: current?.test_id ?? "" })}
          className={tabClass(mode === "test")}
        >
          テスト
        </button>
        <button
          type="button"
          // いま出ている単元・本時から始めるので、押した時点で正しい値が入る
          onClick={() =>
            onChange({ kind: "lesson", unit_name: autoUnitName, lesson_no: autoLessonNo })
          }
          className={tabClass(mode === "lesson")}
        >
          単元を指定
        </button>
      </div>

      {mode === "auto" && (
        <p className="text-xs text-slate-600">
          進度から自動で決まります（{autoUnitName} {autoLessonNo > 0 && `${autoLessonNo}時間目`}）。
        </p>
      )}

      {mode === "test" && (
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">どのテストか（任意）</span>
          <select
            value={current?.test_id ?? ""}
            onChange={(e) => onChange({ kind: "test", test_id: e.target.value })}
            className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
          >
            <option value="">選ばない（「テスト」とだけ出す）</option>
            {testMasters.map((t) => (
              <option key={t.test_id} value={t.test_id}>
                {t.test_name}
                {t.unit_name !== "" ? `（${t.unit_name}）` : ""}
              </option>
            ))}
          </select>
          {testMasters.length === 0 && (
            <span className="mt-1 block text-xs text-slate-500">
              この学年のテストは未登録です。設定のテストマスタで登録できます。
            </span>
          )}
        </label>
      )}

      {mode === "lesson" && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">単元</span>
            <select
              value={selectedUnitName}
              onChange={(e) =>
                onChange({ kind: "lesson", unit_name: e.target.value, lesson_no: 1 })
              }
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
            >
              {annualPlan.map((p) => (
                <option key={p.unit_name} value={p.unit_name}>
                  {p.unit_no !== null ? `${p.unit_no}. ` : ""}
                  {p.unit_name}（{p.allocated_hours}h）
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">本時</span>
            <select
              value={current?.kind === "lesson" ? current.lesson_no : autoLessonNo}
              onChange={(e) =>
                onChange({
                  kind: "lesson",
                  unit_name: selectedUnitName,
                  lesson_no: Number(e.target.value),
                })
              }
              disabled={lessonOptions.length === 0}
              className="w-full rounded border border-slate-300 px-1.5 py-1 text-xs"
            >
              {lessonOptions.map((no) => (
                <option key={no} value={no}>
                  {no}/{selectedUnit?.allocated_hours} 時間目
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
      >
        閉じる
      </button>

      {mode !== "auto" && (
        <p className="text-xs text-slate-600">
          このコマは<strong>単元の時数を使いません。</strong>
          次のコマは自動でもとの単元の続きに戻ります（実施時数には数えます）。
        </p>
      )}
    </div>
  );
}
