import Link from "next/link";

const footerLinks = [
  { href: "/about", label: "关于我们" },
  { href: "/contact", label: "联系我们" },
  { href: "/privacy", label: "隐私政策" },
  { href: "/terms", label: "使用条款" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <div className="font-black text-slate-900">AI圈</div>
          <p className="mt-1">每天 5 分钟，刷完 AI 圈新动态。</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-semibold transition-colors hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
