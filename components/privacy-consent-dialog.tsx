"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "ai-circle-privacy-consent-v1";
const CONSENT_READABLE_PATHS = new Set(["/privacy", "/terms"]);

export function PrivacyConsentDialog() {
  const pathname = usePathname();
  const [isAccepted, setIsAccepted] = useState<boolean | null>(null);
  const canReadPolicyPage = CONSENT_READABLE_PATHS.has(pathname);

  useEffect(() => {
    setIsAccepted(window.localStorage.getItem(CONSENT_STORAGE_KEY) === "accepted");
  }, []);

  useEffect(() => {
    if (isAccepted === false && !canReadPolicyPage) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }

    return undefined;
  }, [canReadPolicyPage, isAccepted]);

  if (isAccepted !== false || canReadPolicyPage) return null;

  function acceptConsent() {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");
    window.localStorage.setItem(`${CONSENT_STORAGE_KEY}:acceptedAt`, new Date().toISOString());
    setIsAccepted(true);
  }

  return (
    <div
      aria-labelledby="privacy-consent-title"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end bg-slate-950/55 px-4 py-5 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-7">
        <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          AI圈 隐私提示
        </div>
        <h2 id="privacy-consent-title" className="mt-4 text-2xl font-black text-slate-950">
          请先阅读并同意隐私政策
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          为向你提供 AI 资讯浏览、热门作品推荐、视频与游戏试玩、账号和投稿反馈等服务，AI圈可能会使用必要的网络请求、
          本地存储、基础访问统计以及第三方广告/内容服务。请在继续使用前阅读并同意相关条款。
        </p>
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
          点击“同意并继续”即表示你已阅读并同意
          <Link className="mx-1 font-black text-blue-700 underline underline-offset-4" href="/privacy">
            《隐私政策》
          </Link>
          和
          <Link className="mx-1 font-black text-blue-700 underline underline-offset-4" href="/terms">
            《使用条款》
          </Link>
          。你也可以先点击链接查看完整内容。
        </div>
        <button
          className="mt-6 w-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-black text-white shadow-soft transition hover:scale-[1.01] active:scale-[0.99]"
          onClick={acceptConsent}
          type="button"
        >
          同意并继续
        </button>
      </div>
    </div>
  );
}
