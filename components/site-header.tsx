"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PenLine, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/interesting", label: "有点意思" },
  { href: "/ranking", label: "榜单" },
  { href: "/portfolio", label: "姜承作品集" },
  { href: "/me", label: "我的" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();

    if (pathname.startsWith("/me")) {
      window.location.href = "/auth";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/70 bg-white/88 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 lg:px-8">
        <Link href="/" prefetch className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <img
            src="/aiq-logo.png"
            alt="AI圈"
            className="h-8 w-auto max-w-[110px] object-contain sm:h-9 sm:max-w-[132px] lg:h-10 lg:max-w-[150px]"
          />
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
                prefetch
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
          {user ? (
            <>
              <Link
                href="/me"
                className="hidden items-center gap-2 rounded-full px-2 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:inline-flex"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">
                  {user.avatarText}
                </span>
                <span className="max-w-24 truncate">{user.name}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:inline-flex"
              >
                <LogOut className="h-4 w-4" />
                退出
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 sm:inline-flex"
            >
              <UserRound className="h-4 w-4" />
              登录
            </Link>
          )}
          <Link
            href="/submit"
            className={cn(
              buttonVariants({ variant: "gradient", size: "sm" }),
              "h-10 px-4 text-sm sm:h-auto sm:px-5",
            )}
          >
            <PenLine className="h-4 w-4" />
            投稿
          </Link>
        </div>
      </div>
    </header>
  );
}
