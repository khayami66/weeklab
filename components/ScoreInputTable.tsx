"use client";

import { useMemo, useRef, useState } from "react";
import type { TestMaster, TestResult, TestScore, ViewPoint } from "@/types";
import { ROSTER_ROWS, SCORED_VIEWPOINTS, VIEWPOINT_LABELS } from "@/lib/grading";

export type InputDirection = "vertical" | "horizontal";

type Column = {
  test_id: string;
  test_name: string;
  viewpoint: ViewPoint;
  max: number;
  /** そのテストの最初の列か（テスト間の区切り線用） */
  firstOfTest: boolean;
};

type Props = {
  /** 列として並べるテスト（左から順） */
  tests: TestMaster[];
  /** test_id → そのクラスの得点 */
  draft: Record<string, TestResult>;
  direction: InputDirection;
  onScoreChange: (
    test_id: string,
    student_no: number,
    viewpoint: ViewPoint,
    value: number | null
  ) => void;
  onDateChange: (test_id: string, conducted_on: string) => void;
};

/**
 * 得点入力テーブル（grading_design.md §5.4）。
 *
 * 紙の名簿1枚＝画面1枚にするため、**クラス主軸でテストを列に並べる**。
 * 入力量が多いので、以下は速度のための必須要件として作り込んである：
 *   - 出席番号は常に 1〜35 行（在籍人数を設定しないため）
 *   - Enter で「縦（列を打ち切る）」か「横（1人ずつ）」に移動。紙の並びに合わせる
 *   - ↑↓ で行移動、Tab で横移動。保存以外でマウスを使わせない
 *   - 入力中の行をハイライト、5行ごとに罫線を濃く（行を見失わせない）
 *   - 空欄＝未受験（null）。0点とは明確に区別する
 */
export default function ScoreInputTable({
  tests,
  draft,
  direction,
  onScoreChange,
  onDateChange,
}: Props) {
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = [];
    for (const t of tests) {
      let first = true;
      for (const vp of SCORED_VIEWPOINTS) {
        const max = vp === "knowledge" ? t.max_knowledge : t.max_thinking;
        if (max <= 0) continue; // 出題のない観点は列を作らない
        cols.push({
          test_id: t.test_id,
          test_name: t.test_name,
          viewpoint: vp,
          max,
          firstOfTest: first,
        });
        first = false;
      }
    }
    return cols;
  }, [tests]);

  /** `${test_id}:${student_no}` → TestScore（毎レンダーの find を避ける） */
  const scoreMap = useMemo(() => {
    const map = new Map<string, TestScore>();
    for (const result of Object.values(draft)) {
      for (const s of result.scores) {
        map.set(`${result.test_id}:${s.student_no}`, s);
      }
    }
    return map;
  }, [draft]);

  const valueOf = (col: Column, studentNo: number): number | null => {
    const s = scoreMap.get(`${col.test_id}:${studentNo}`);
    if (!s) return null;
    return col.viewpoint === "knowledge" ? s.knowledge : s.thinking;
  };

  const cellKey = (colIndex: number, row: number) => `${colIndex}:${row}`;

  const focusCell = (colIndex: number, row: number) => {
    if (colIndex < 0 || colIndex >= columns.length) return;
    if (row < 1 || row > ROSTER_ROWS) return;
    const el = inputRefs.current.get(cellKey(colIndex, row));
    if (el) {
      el.focus();
      el.select();
    }
  };

  /** Enter を押したときの移動先。direction で縦横が変わる */
  const moveNext = (colIndex: number, row: number) => {
    if (direction === "vertical") {
      if (row < ROSTER_ROWS) focusCell(colIndex, row + 1);
      else focusCell(colIndex + 1, 1); // 列を打ち切ったら次の列の先頭へ
    } else {
      if (colIndex < columns.length - 1) focusCell(colIndex + 1, row);
      else focusCell(0, row + 1); // 行を打ち切ったら次の行の先頭へ
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, colIndex: number, row: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      moveNext(colIndex, row);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(colIndex, row + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(colIndex, row - 1);
    }
    // ← → はカーソル移動に残す。列移動は Tab / Shift+Tab（ブラウザ標準）
  };

  if (columns.length === 0) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        表示するテストがありません。上の「表示するテスト」で選ぶか、設定画面で
        テストマスタを登録してください。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          {/* テスト名と実施日 */}
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-600">
              番号
            </th>
            {tests.map((t) => {
              const span = columns.filter((c) => c.test_id === t.test_id).length;
              if (span === 0) return null;
              return (
                <th
                  key={t.test_id}
                  colSpan={span}
                  className="border-b border-l border-slate-300 px-2 py-2 text-center"
                >
                  <div className="text-xs font-bold text-slate-700">{t.test_name}</div>
                  <input
                    type="date"
                    value={draft[t.test_id]?.conducted_on ?? ""}
                    onChange={(e) => onDateChange(t.test_id, e.target.value)}
                    aria-label={`${t.test_name} の実施日`}
                    className="mt-1 rounded border border-slate-300 px-1 py-0.5 text-xs"
                  />
                </th>
              );
            })}
          </tr>
          {/* 観点と満点 */}
          <tr className="bg-slate-50">
            <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-2 py-1" />
            {columns.map((col, i) => (
              <th
                key={`${col.test_id}:${col.viewpoint}`}
                className={`border-b border-slate-200 px-2 py-1 text-center text-xs font-medium text-slate-600 ${
                  col.firstOfTest && i > 0 ? "border-l border-l-slate-300" : ""
                }`}
              >
                {col.viewpoint === "knowledge" ? "知技" : "思判表"}
                <span className="ml-1 font-normal text-slate-400">({col.max})</span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from({ length: ROSTER_ROWS }, (_, i) => i + 1).map((row) => {
            const isActive = activeRow === row;
            const blockEnd = row % 5 === 0 && row !== ROSTER_ROWS;
            return (
              <tr
                key={row}
                className={`${isActive ? "bg-blue-50" : "bg-white"} ${
                  blockEnd ? "border-b-2 border-b-slate-300" : "border-b border-slate-100"
                }`}
              >
                <td
                  className={`sticky left-0 z-10 border-r border-slate-200 px-2 py-1 text-center text-xs font-medium tabular-nums ${
                    isActive ? "bg-blue-100 text-blue-800" : "bg-white text-slate-500"
                  }`}
                >
                  {row}
                </td>
                {columns.map((col, colIndex) => {
                  const value = valueOf(col, row);
                  const over = value !== null && value > col.max;
                  return (
                    <td
                      key={`${col.test_id}:${col.viewpoint}`}
                      className={`px-1 py-1 text-center ${
                        col.firstOfTest && colIndex > 0 ? "border-l border-slate-300" : ""
                      }`}
                    >
                      <input
                        // 数値入力に type="number" を使わない：
                        // 表をスクロールしたときにホイールで値が書き換わる事故が起きる
                        type="text"
                        inputMode="numeric"
                        value={value === null ? "" : String(value)}
                        ref={(el) => {
                          const key = cellKey(colIndex, row);
                          if (el) inputRefs.current.set(key, el);
                          else inputRefs.current.delete(key);
                        }}
                        onFocus={() => setActiveRow(row)}
                        onBlur={() => setActiveRow((r) => (r === row ? null : r))}
                        onKeyDown={(e) => handleKeyDown(e, colIndex, row)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          onScoreChange(
                            col.test_id,
                            row,
                            col.viewpoint,
                            digits === "" ? null : Number(digits)
                          );
                        }}
                        aria-label={`出席番号${row} ${col.test_name} ${VIEWPOINT_LABELS[col.viewpoint]}`}
                        className={`w-14 rounded border px-1 py-1 text-center text-sm tabular-nums focus:outline-none focus:ring-2 ${
                          over
                            ? "border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-300"
                            : "border-slate-300 focus:border-blue-500 focus:ring-blue-200"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>

        {/* 入力状況：打ち漏らしをその場で見つけるため */}
        <tfoot>
          <tr className="bg-slate-50">
            <td className="sticky left-0 z-10 border-t border-r border-slate-200 bg-slate-50 px-2 py-2 text-xs font-medium text-slate-600">
              入力
            </td>
            {columns.map((col, colIndex) => {
              const entered: number[] = [];
              for (let row = 1; row <= ROSTER_ROWS; row++) {
                const v = valueOf(col, row);
                if (v !== null) entered.push(v);
              }
              const avg =
                entered.length > 0
                  ? Math.round((entered.reduce((a, b) => a + b, 0) / entered.length) * 10) / 10
                  : null;
              return (
                <td
                  key={`${col.test_id}:${col.viewpoint}`}
                  className={`border-t border-slate-200 px-1 py-2 text-center text-xs text-slate-600 ${
                    col.firstOfTest && colIndex > 0 ? "border-l border-slate-300" : ""
                  }`}
                >
                  <div className="tabular-nums">{entered.length}名</div>
                  <div className="text-slate-400 tabular-nums">
                    {avg === null ? "—" : `平均 ${avg}`}
                  </div>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
