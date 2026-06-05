"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Shuffle } from "lucide-react";

type ItchioGameFrameProps = {
  title: string;
  frameUrl: string;
  externalUrl: string;
  reloadUrl: string;
  switchModeUrl: string;
  modeLabel: string;
};

export function ItchioGameFrame({
  title,
  frameUrl,
  externalUrl,
  reloadUrl,
  switchModeUrl,
  modeLabel,
}: ItchioGameFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const slowTimer = window.setTimeout(() => {
      setSlow(true);
    }, 12000);

    return () => window.clearTimeout(slowTimer);
  }, [frameUrl]);

  return (
    <div className="relative h-[calc(100svh-9rem)] min-h-[430px] bg-black sm:h-[calc(100vh-11rem)] sm:min-h-[520px]">
      <iframe
        src={frameUrl}
        title={title}
        allow="autoplay; fullscreen; gamepad; gyroscope; accelerometer; clipboard-read; clipboard-write"
        allowFullScreen
        loading="eager"
        scrolling="no"
        referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-presentation allow-orientation-lock allow-downloads allow-modals"
        className="h-full w-full border-0 bg-black"
        onLoad={() => setLoaded(true)}
      />

      {!loaded ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black text-white">
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-bold text-white/85 ring-1 ring-white/15">
            正在启动游戏...
          </div>
        </div>
      ) : null}

      {slow ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-slate-950/90 p-3 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur sm:bottom-4 sm:left-auto sm:w-[360px]">
          <p className="text-sm font-black">游戏启动较慢或卡住了</p>
          <p className="mt-1 text-xs leading-5 text-white/65">
            当前为{modeLabel}。部分 Unity/itch.io 游戏对内嵌环境有限制，可以先在当前容器内切换兼容模式重试。
          </p>
          <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
            <a
              href={reloadUrl}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新加载
            </a>
            <a
              href={switchModeUrl}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-500 px-3 py-2 text-xs font-bold text-white hover:bg-blue-400"
            >
              <Shuffle className="h-3.5 w-3.5" />
              切换兼容模式
            </a>
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-white/90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              原网站
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
