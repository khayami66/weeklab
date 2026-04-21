export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold text-blue-600">Weeklab</span>
          <span className="text-sm text-slate-500">2026年度</span>
        </div>
        <div className="text-sm text-slate-500">{formatToday()}</div>
      </div>
    </header>
  );
}

function formatToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${y}年${m}月${d}日 (${days[now.getDay()]})`;
}
