import Link from "next/link";

const items = [
  { href: "/", label: "ホーム" },
  { href: "/weekly", label: "週案" },
  { href: "/progress", label: "進度" },
  { href: "/timetable", label: "時間割" },
  { href: "/settings", label: "設定" },
];

export default function MobileNav() {
  return (
    <nav className="md:hidden border-t border-slate-200 bg-white">
      <ul className="flex justify-around py-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block px-3 py-2 text-xs text-slate-700 hover:text-blue-600"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
