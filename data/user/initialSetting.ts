import type { TeacherSetting } from "@/types";

/**
 * 教員個人設定の初期値
 *
 * 初回起動時に localStorage が空ならこの値を書き込む。
 * ユーザーは `/settings` 画面でいつでも編集可能。
 *
 * MVP 初期値：松戸市立梨香台小学校（ご自身の所属校）
 * 他校ユーザーは `/settings` 画面で学校情報を書き換えて利用。
 */
export const initialSetting: TeacherSetting = {
  school_year: 2026,
  school_name: "松戸市立梨香台小学校",
  teacher_name: "速見公宏",
  teacher_type: "specialist",
  start_date: "2026-04-06",
  grade_configs: [
    { grade: 3, class_count: 3, pack_id: "keirinkan.science.grade3" },
    { grade: 4, class_count: 4, pack_id: "keirinkan.science.grade4" },
  ],
};
