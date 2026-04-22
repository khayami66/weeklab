import { describe, expect, it } from "vitest";
import { formatDate, getMondayOf, getWeekDates, getWeekNumber, parseISODate } from "./date";

const toYMD = (d: Date): string => formatDate(d, "YYYY-MM-DD");

// 2026-04-06 は月曜日（始業式日）
describe("getMondayOf", () => {
  it("月曜日を渡したら当日の月曜日を返す", () => {
    expect(toYMD(getMondayOf(parseISODate("2026-04-06")))).toBe("2026-04-06");
  });

  it("水曜日を渡したら同週の月曜日を返す", () => {
    expect(toYMD(getMondayOf(parseISODate("2026-04-08")))).toBe("2026-04-06");
  });

  it("土曜日を渡したら同週の月曜日を返す", () => {
    expect(toYMD(getMondayOf(parseISODate("2026-04-11")))).toBe("2026-04-06");
  });

  it("日曜日を渡したら前週の月曜日を返す（月曜開始の週管理）", () => {
    // 2026-04-05 は日曜日 → 直前の月曜日 2026-03-30
    expect(toYMD(getMondayOf(parseISODate("2026-04-05")))).toBe("2026-03-30");
  });

  it("月をまたぐ週でも正しく月曜日を返す", () => {
    // 2026-05-01 は金曜日 → 同週月曜は 2026-04-27
    expect(toYMD(getMondayOf(parseISODate("2026-05-01")))).toBe("2026-04-27");
  });

  it("時分秒は 00:00:00 に正規化される", () => {
    const input = parseISODate("2026-04-08");
    input.setHours(14, 30, 45);
    const result = getMondayOf(input);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });
});

describe("getWeekDates", () => {
  it("月〜土の6日分の Date 配列を返す", () => {
    const monday = parseISODate("2026-04-06");
    const dates = getWeekDates(monday);
    expect(dates).toHaveLength(6);
    expect(dates.map(toYMD)).toEqual([
      "2026-04-06", // 月
      "2026-04-07", // 火
      "2026-04-08", // 水
      "2026-04-09", // 木
      "2026-04-10", // 金
      "2026-04-11", // 土
    ]);
  });

  it("月またぎ週でも正しく6日分を返す（月基準は月曜日の月）", () => {
    // 2026-04-27 (月) の週：04-27〜05-02（月〜土）
    const monday = parseISODate("2026-04-27");
    const dates = getWeekDates(monday);
    expect(dates.map(toYMD)).toEqual([
      "2026-04-27",
      "2026-04-28",
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
    ]);
  });
});

describe("getWeekNumber", () => {
  const startDate = "2026-04-06"; // 始業式日（月）

  it("始業式日（月曜）は第1週", () => {
    expect(getWeekNumber(parseISODate("2026-04-06"), startDate)).toBe(1);
  });

  it("始業式週の金曜日も第1週", () => {
    expect(getWeekNumber(parseISODate("2026-04-10"), startDate)).toBe(1);
  });

  it("始業式週の土曜日も第1週", () => {
    expect(getWeekNumber(parseISODate("2026-04-11"), startDate)).toBe(1);
  });

  it("翌週月曜日は第2週", () => {
    expect(getWeekNumber(parseISODate("2026-04-13"), startDate)).toBe(2);
  });

  it("10週後の月曜日は第10週", () => {
    // 2026-04-06 + 9週 = 2026-06-08
    expect(getWeekNumber(parseISODate("2026-06-08"), startDate)).toBe(10);
  });

  it("始業式日より前の週は 0 以下を返す", () => {
    // 2026-03-30 (月) は始業式の 1 週間前
    expect(getWeekNumber(parseISODate("2026-03-30"), startDate)).toBe(0);
  });
});

describe("formatDate", () => {
  const date = parseISODate("2026-04-06");

  it("YYYY-MM-DD 形式", () => {
    expect(formatDate(date, "YYYY-MM-DD")).toBe("2026-04-06");
  });

  it("M月D日 形式（ゼロパディングなし）", () => {
    expect(formatDate(date, "M月D日")).toBe("4月6日");
  });

  it("MM月DD日 形式（ゼロパディングあり）", () => {
    expect(formatDate(date, "MM月DD日")).toBe("04月06日");
  });

  it("YYYY年M月D日 形式（和暦風）", () => {
    expect(formatDate(date, "YYYY年M月D日")).toBe("2026年4月6日");
  });

  it("10月以降・10日以降の日付も正しい", () => {
    const d = parseISODate("2026-12-25");
    expect(formatDate(d, "YYYY-MM-DD")).toBe("2026-12-25");
    expect(formatDate(d, "M月D日")).toBe("12月25日");
  });
});

describe("parseISODate", () => {
  it("YYYY-MM-DD をローカルタイムの Date に変換", () => {
    const d = parseISODate("2026-04-06");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(3); // 0-indexed
    expect(d.getDate()).toBe(6);
    // タイムゾーン依存を避けるため、toISOString でのチェックは行わない
  });
});
