"use client";

import { useEffect, useState } from "react";

type CapacitorWindow = Window & {
  Capacitor?: {
    getPlatform?: () => string;
    isNativePlatform?: () => boolean;
  };
};

export function AppBootLoading() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isRunningInNativeApp()) return;

    let hideTimer: number | undefined;
    const showStartedAt = Date.now();
    const showTimer = window.setTimeout(() => setVisible(true), 0);

    const hide = () => {
      const elapsed = Date.now() - showStartedAt;
      hideTimer = window.setTimeout(() => setVisible(false), Math.max(0, 650 - elapsed));
    };

    if (document.readyState === "complete") {
      hide();
    } else {
      window.addEventListener("load", hide, { once: true });
      hideTimer = window.setTimeout(hide, 5000);
    }

    return () => {
      window.removeEventListener("load", hide);
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-full max-w-xs rounded-[2rem] bg-white/90 p-7 shadow-2xl ring-1 ring-slate-200/80">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-violet-600 text-2xl font-black text-white shadow-soft">
          AI
        </div>
        <div className="mx-auto mt-5 h-1.5 w-36 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 animate-[appBootLoading_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-blue-500 to-violet-500" />
        </div>
        <p className="mt-4 text-sm font-black text-slate-900">正在加载 AI圈</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">每日 AI 新动态马上回来</p>
      </div>
    </div>
  );
}

function isRunningInNativeApp() {
  const capacitor = (window as CapacitorWindow).Capacitor;
  if (!capacitor) return false;

  if (typeof capacitor.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }

  if (typeof capacitor.getPlatform === "function") {
    return capacitor.getPlatform() !== "web";
  }

  return false;
}
