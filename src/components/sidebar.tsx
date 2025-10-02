"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/canvas", label: "Canvas" },
  { href: "/video-studio", label: "Video Studio" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900/70 border-r border-white/5 backdrop-blur flex flex-col p-6 gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workspace</p>
        <h1 className="mt-2 text-xl font-semibold">ImageGen Canvas</h1>
        <p className="mt-1 text-sm text-slate-400">
          Arrange generations, references, and iterate visually.
        </p>
      </div>
      <nav className="flex flex-col gap-3 text-sm text-slate-300">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`inline-flex items-center rounded-md px-3 py-2 text-left transition ${
                isActive ? "bg-white/10 text-white" : "hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
