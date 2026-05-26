"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesColumnIncreasing,
  Compass,
  GalleryVerticalEnd,
  Home,
  Sparkles,
  UserRound,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "首页", icon: Home },
  { href: "/interesting", label: "有点意思", icon: Compass },
  { href: "/skills", label: "Skill", icon: Sparkles },
  { href: "/ranking", label: "榜单", icon: ChartNoAxesColumnIncreasing },
  { href: "/portfolio", label: "作品集", icon: GalleryVerticalEnd },
  { href: "/me", label: "我的", icon: UserRound },
];

export function MobileTabbar() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.7rem)] z-[60] px-3 md:hidden">
      <div className="pointer-events-auto mx-auto grid max-w-screen-sm grid-cols-6 gap-1 rounded-[1.75rem] border border-white/80 bg-white/95 p-2 shadow-[0_18px_42px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              href={item.href}
              prefetch
              key={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10px] font-semibold text-slate-500 transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-blue-600/12 to-violet-600/12 text-blue-700 shadow-sm"
                  : "hover:bg-slate-50",
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
