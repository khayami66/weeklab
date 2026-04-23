"use client";

import { useEffect, useState } from "react";
import { useSetting } from "@/hooks/useSetting";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export default function Header() {
  const { setting } = useSetting();
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    const updateToday = () => {
      const now = new Date();
      setToday(
        `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 (${WEEKDAY_LABELS[now.getDay()]})`
      );
    };
    updateToday();
    // ページを長時間開いたままにしても日付が追従するよう、1時間おきに更新
    const interval = setInterval(updateToday, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const yearLabel = setting ? `${setting.school_year}年度` : "年度";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold text-blue-600">Weeklab</span>
          <span className="text-sm text-slate-500">{yearLabel}</span>
        </div>
        <div className="text-sm text-slate-500">{today}</div>
      </div>
    </header>
  );
}
