import type { Timetable } from "@/types";

/**
 * 基本時間割の初期値
 *
 * **空配列**：時間割はユーザーが `/timetable` 画面で自校の時間割を入力する。
 * 松戸市立梨香台小学校を含む特定校の時間割はハードコードしない
 * （他校・他ユーザー展開を考慮、真の二層構造の実現）。
 */
export const initialTimetable: Timetable[] = [];
