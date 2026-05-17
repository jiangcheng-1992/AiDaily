"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChartNoAxesColumnIncreasing,
  Home,
  PenLine,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "首页", icon: Home },
  { href: "/skills", label: "Skill", icon: Sparkles },
  { href: "/ranking", label: "榜单", icon: ChartNoAxesColumnIncreasing },
  { href: "/submit", label: "投稿", icon: PenLine },
  { href: "/saved", label: "收藏", icon: Bookmark },
  { href: "/me", label: "我的", icon: UserRound },
];

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 rounded-3xl border border-white/80 bg-white/90 px-2 py-2 shadow-lift backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-6">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              href={item.href}
              key={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-xs font-semibold text-slate-500 transition-colors",
                active && "bg-blue-50 text-blue-700",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
