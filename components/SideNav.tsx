import Link from "next/link";

const items = [
  { href: "/", label: "ホーム" },
  { href: "/weekly", label: "週案" },
  { href: "/progress", label: "進度管理" },
  { href: "/monthly", label: "月次集計" },
  { href: "/master", label: "マスタ" },
  { href: "/archive", label: "アーカイブ" },
  { href: "/settings", label: "設定" },
];

export default function SideNav() {
  return (
    <nav className="hidden md:block w-48 border-r border-slate-200 bg-white">
      <ul className="py-4">
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
