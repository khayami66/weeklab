import type { LessonMaster } from "@/types";

const PACK_ID = "keirinkan.science.grade4";

/**
 * 啓林館 小学校理科 4年 本時マスタ
 *
 * 運用方針：2単元先行整備（現単元＋次単元の2単元分を常にカバー）
 * 本時タイトル・授業内容は空枠。ユーザーが実際の授業に合わせて編集していく。
 * 未整備の本時は週案画面で lesson_title="(未作成)" として表示される。
 *
 * MVP初期整備：理科のガイダンス / 春の生き物（計9時間）
 */
export const lessonMaster: LessonMaster[] = [
  // 理科のガイダンス（1時間）
  {
    pack_id: PACK_ID,
    unit_name: "理科のガイダンス",
    lesson_no: 1,
    total_hours: 1,
    lesson_title: "",
    content: "",
    note: "",
  },
  // 春の生き物（8時間）
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 1,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 2,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 3,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 4,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 5,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 6,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 7,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
  {
    pack_id: PACK_ID,
    unit_name: "春の生き物",
    lesson_no: 8,
    total_hours: 8,
    lesson_title: "",
    content: "",
    note: "",
  },
];
