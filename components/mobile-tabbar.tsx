"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChartNoAxesColumnIncreasing,
  GalleryVerticalEnd,
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
  { href: "/portfolio", label: "作品集", icon: GalleryVerticalEnd },
  { href: "/me", label: "我的", icon: UserRound },
];

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/96 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-screen-sm grid-cols-7 gap-1">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              href={item.href}
              key={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[11px] font-semibold text-slate-500 transition-colors",
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
