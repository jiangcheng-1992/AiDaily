"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/ranking", label: "榜单" },
  { href: "/saved", label: "收藏" },
  { href: "/me", label: "我的" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="text-3xl font-black leading-none tracking-normal brand-gradient">
            AI圈
          </span>
          <span className="hidden max-w-[240px] truncate text-sm text-slate-500 lg:block">
            每天 5 分钟，刷完 AI 圈新动态
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            return (
              <Link
                href={item.href}
                key={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
                  active &&
                    "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-soft hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/me"
            className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:inline-flex"
          >
            <UserRound className="h-4 w-4" />
            登录
          </Link>
          <Link
            href="/submit"
            className={cn(buttonVariants({ variant: "gradient", size: "sm" }))}
          >
            <PenLine className="h-4 w-4" />
            投稿
          </Link>
        </div>
      </div>
    </header>
  );
}
