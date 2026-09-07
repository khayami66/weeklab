import Link from "next/link";

const items = [
  { href: "/", label: "ホーム" },
  { href: "/weekly", label: "週案" },
  { href: "/progress", label: "進度管理" },
  { href: "/grades", label: "成績処理" },
  { href: "/monthly", label: "月次集計" },
  { href: "/master", label: "授業案・マスタ" },
  { href: "/archive", label: "アーカイブ" },
  { href: "/settings", label: "設定" },
];

/**
 * PC 用のサイドナビ。
 *
 * **画面をスクロールしてもナビは動かない**（本体だけがスクロールする）。
 * 成績入力の35行テーブルのように縦に長い画面で、
 * 下までスクロールするとナビが見えなくなり、別の画面へ移るのに
 * 一度いちばん上まで戻る必要があったため。
 *
 * 実装：`nav` 自体は flex の伸長でページ全高になり、
 * 中身を `sticky top-0` で貼り付ける。項目が画面高を超える場合だけ
 * ナビの中でスクロールする（`max-h-screen overflow-y-auto`）。
 */
export default function SideNav() {
  return (
    <nav className="no-print hidden w-48 shrink-0 border-r border-slate-200 bg-white md:block">
      <ul className="sticky top-0 max-h-screen overflow-y-auto py-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block px-6 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
