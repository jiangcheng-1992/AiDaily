"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Hand,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

import { playAudioFx } from "@/lib/audio-fx";
import { fortuneCards, pickDailyFortuneCard, type FortuneCard } from "@/lib/fortune-data";
import { cn } from "@/lib/utils";

type RitualPhase = "intro" | "scanning" | "cards" | "revealing" | "result";

export function AiFortuneEntry() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-3xl border border-violet-200/70 bg-slate-950 p-5 text-left text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lift"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.65),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.32),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(88,28,135,0.9))]" />
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-2xl transition-transform group-hover:scale-125" />
        <div className="relative">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            今日 AI 运势
          </div>
          <h3 className="text-xl font-black tracking-normal">唤醒你的灵感卡</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-violet-100/82">
            摄像头能量场、悬浮卡牌和星光揭示，抽取今天最适合你的 AI 灵感建议。
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-violet-700">
              开启仪式
              <WandSparkles className="h-4 w-4" />
            </span>
            <span className="text-3xl">✦</span>
          </div>
        </div>
      </button>
      {open ? <AiFortuneModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AiFortuneModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<RitualPhase>("intro");
  const [cameraError, setCameraError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => pickDailyFortuneCard().id - 1);
  const [selectedCard, setSelectedCard] = useState<FortuneCard | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50, active: false });
  const cards = fortuneCards;
  const activeCard = cards[activeIndex] ?? cards[0];
  const particles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        id: index,
        left: `${(index * 37) % 100}%`,
        top: `${(index * 53) % 100}%`,
        delay: `${(index % 9) * 0.28}s`,
        size: 2 + (index % 4),
      })),
    [],
  );

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      stopCamera(streamRef.current);
    };
  }, []);

  async function startRitual() {
    playAudioFx("open");
    setCameraError("");
    setPhase("scanning");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      playAudioFx("detect");
      window.setTimeout(() => setPhase("cards"), 950);
    } catch {
      setCameraError("摄像头权限未开启，已切换为手动抽卡模式。");
      window.setTimeout(() => setPhase("cards"), 650);
    }
  }

  function rotateCards(direction: -1 | 1) {
    if (phase === "revealing" || phase === "result") return;
    setPhase("cards");
    setActiveIndex((current) => (current + direction + cards.length) % cards.length);
    playAudioFx("move");
  }

  function revealCard(card = activeCard) {
    if (phase === "revealing" || phase === "result") return;
    setSelectedCard(card);
    setPhase("revealing");
    playAudioFx("focus");
    window.setTimeout(() => {
      playAudioFx("reveal");
      setPhase("result");
    }, 1400);
  }

  function resetRitual() {
    setSelectedCard(null);
    setPhase(cameraOn ? "cards" : "intro");
    setActiveIndex((current) => (current + 5) % cards.length);
    playAudioFx("open");
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCursor({ x, y, active: true });
  }

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-slate-950 text-white"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setCursor((current) => ({ ...current, active: false }))}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(147,51,234,0.45),transparent_36%),radial-gradient(circle_at_15%_80%,rgba(14,165,233,0.28),transparent_30%),linear-gradient(135deg,#020617,#1e103f_55%,#020617)]" />
      <div className="absolute inset-0 opacity-70">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="absolute rounded-full bg-white/80 shadow-[0_0_14px_rgba(255,255,255,0.9)] ai-fortune-twinkle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
              animationDelay: particle.delay,
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-30 rounded-full border border-white/10 bg-white/10 p-3 text-white backdrop-blur transition-colors hover:bg-white/20"
        aria-label="关闭今日 AI 运势"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="pointer-events-none absolute z-20 hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/60 bg-cyan-300/10 shadow-[0_0_42px_rgba(34,211,238,0.55)] md:block"
        style={{
          left: `${cursor.x}%`,
          top: `${cursor.y}%`,
          opacity: cursor.active ? 1 : 0,
        }}
      />

      <div className="relative z-10 flex h-full flex-col px-4 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-white/10 px-4 py-1.5 text-xs font-black text-violet-100 backdrop-blur">
              <Hand className="h-4 w-4 text-cyan-200" />
              AI 魔法仪式
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-white sm:text-5xl">
              抬起你的手，唤醒今日灵感卡
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-violet-100/75">
              摄像头画面仅在本地浏览器用于沉浸式互动，不上传、不保存。鼠标或触摸也可以操控卡牌。
            </p>
          </div>

          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="relative min-h-[260px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/8 p-3 shadow-[0_0_80px_rgba(88,28,135,0.32)] backdrop-blur">
              <video
                ref={videoRef}
                playsInline
                muted
                className={cn(
                  "h-full min-h-[260px] w-full scale-x-[-1] rounded-[1.5rem] object-cover opacity-55 grayscale-[0.15]",
                  cameraOn ? "block" : "hidden",
                )}
              />
              {!cameraOn ? (
                <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-violet-300/25 bg-slate-950/55 text-center">
                  <Camera className="h-12 w-12 text-cyan-200" />
                  <p className="mt-4 text-lg font-black">摄像头能量场待开启</p>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-violet-100/65">
                    开启后会出现玻璃质感摄像头画面、能量光环和悬浮卡牌阵。
                  </p>
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-3 rounded-[1.5rem] bg-gradient-to-br from-violet-700/30 via-transparent to-cyan-500/20" />
              <div className="pointer-events-none absolute inset-5 rounded-[1.2rem] border border-cyan-200/20 shadow-[inset_0_0_42px_rgba(34,211,238,0.12)]" />
              <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/10 bg-slate-950/58 p-3 text-xs font-semibold leading-5 text-violet-100 backdrop-blur">
                {phase === "intro"
                  ? "点击开启摄像头，进入今日 AI 灵感仪式。"
                  : phase === "scanning"
                    ? "检测到能量场，正在连接今日灵感频率..."
                    : "左右滑动/点击箭头切换卡牌，点击当前卡牌揭示今日灵感。"}
                {cameraError ? <span className="mt-1 block text-amber-200">{cameraError}</span> : null}
              </div>
            </div>

            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/35 backdrop-blur">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.25),transparent_42%)]" />
              {phase === "intro" ? (
                <div className="relative z-10 max-w-md px-6 text-center">
                  <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full border border-amber-200/35 bg-amber-200/10 shadow-[0_0_60px_rgba(251,191,36,0.35)]">
                    <WandSparkles className="h-10 w-10 text-amber-200" />
                  </div>
                  <button
                    type="button"
                    onClick={startRitual}
                    className="rounded-full bg-white px-7 py-4 text-sm font-black text-violet-800 shadow-[0_0_34px_rgba(255,255,255,0.22)] transition-transform hover:scale-105"
                  >
                    开启摄像头，唤醒卡牌
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("cards")}
                    className="mt-4 block w-full text-xs font-bold text-violet-100/65 underline-offset-4 hover:text-white hover:underline"
                  >
                    跳过摄像头，使用手动抽卡
                  </button>
                </div>
              ) : null}

              {phase !== "intro" ? (
                <>
                  <CardOrbit
                    activeIndex={activeIndex}
                    cards={cards}
                    onReveal={revealCard}
                    phase={phase}
                    selectedCard={selectedCard}
                  />
                  <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => rotateCards(-1)}
                      className="rounded-full border border-white/10 bg-white/10 p-3 backdrop-blur transition-colors hover:bg-white/20"
                      aria-label="上一张卡牌"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => revealCard()}
                      className="rounded-full bg-amber-200 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.35)] transition-transform hover:scale-105"
                    >
                      揭示灵感
                    </button>
                    <button
                      type="button"
                      onClick={() => rotateCards(1)}
                      className="rounded-full border border-white/10 bg-white/10 p-3 backdrop-blur transition-colors hover:bg-white/20"
                      aria-label="下一张卡牌"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </>
              ) : null}

              {phase === "result" && selectedCard ? (
                <FortuneResult card={selectedCard} onReset={resetRitual} />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes aiFortuneTwinkle {
          0%,
          100% {
            opacity: 0.25;
            transform: translate3d(0, 0, 0) scale(0.8);
          }
          50% {
            opacity: 1;
            transform: translate3d(0, -14px, 0) scale(1.35);
          }
        }
        @keyframes aiFortuneFloat {
          0%,
          100% {
            transform: translateY(0) rotateZ(-1deg);
          }
          50% {
            transform: translateY(-10px) rotateZ(1deg);
          }
        }
        @keyframes aiFortuneReveal {
          0% {
            opacity: 0;
            transform: translate(-50%, -44%) rotateY(90deg) scale(0.86);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, -50%) rotateY(0deg) scale(1);
          }
        }
        .ai-fortune-twinkle {
          animation: aiFortuneTwinkle 3.2s ease-in-out infinite;
        }
        .ai-fortune-floating {
          animation: aiFortuneFloat 5s ease-in-out infinite;
        }
        .ai-fortune-result {
          animation: aiFortuneReveal 0.82s cubic-bezier(0.2, 0.9, 0.2, 1) both;
        }
      `}</style>
    </div>
  );
}

function CardOrbit({
  cards,
  activeIndex,
  phase,
  selectedCard,
  onReveal,
}: {
  cards: FortuneCard[];
  activeIndex: number;
  phase: RitualPhase;
  selectedCard: FortuneCard | null;
  onReveal: (card: FortuneCard) => void;
}) {
  return (
    <div className="relative h-full min-h-[420px] w-full" style={{ perspective: 1200 }}>
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-300/20 shadow-[0_0_80px_rgba(168,85,247,0.25)]" />
      {cards.map((card, index) => {
        const offset = getOrbitOffset(index, activeIndex, cards.length);
        const isActive = offset === 0;
        const isSelected = selectedCard?.id === card.id;
        const hiddenDuringReveal = phase === "revealing" && !isSelected;

        return (
          <button
            type="button"
            key={card.id}
            onClick={() => (isActive ? onReveal(card) : undefined)}
            className={cn(
              "absolute left-1/2 top-1/2 h-52 w-36 rounded-[1.45rem] border border-amber-200/38 bg-slate-950/90 p-3 text-left text-white shadow-[0_0_38px_rgba(168,85,247,0.28)] transition-all duration-500",
              isActive && "z-20 border-amber-200/80 shadow-[0_0_54px_rgba(251,191,36,0.35)] ai-fortune-floating",
              hiddenDuringReveal && "opacity-0 blur-md",
            )}
            style={{
              transform: `translate(-50%, -50%) translateX(${offset * 62}px) translateZ(${isActive ? 70 : -Math.abs(offset) * 40}px) rotateY(${offset * -18}deg) scale(${isActive ? 1.08 : Math.max(0.58, 0.88 - Math.abs(offset) * 0.08)})`,
              opacity: hiddenDuringReveal ? 0 : Math.max(0.16, 1 - Math.abs(offset) * 0.18),
              pointerEvents: isActive ? "auto" : "none",
            }}
          >
            <MysteryCard card={card} active={isActive} />
          </button>
        );
      })}
    </div>
  );
}

function MysteryCard({ card, active }: { card: FortuneCard; active: boolean }) {
  return (
    <div className={cn("relative h-full overflow-hidden rounded-[1.15rem] bg-gradient-to-br", card.gradient)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.34),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.62))]" />
      <div className="absolute inset-2 rounded-[0.95rem] border border-amber-100/55" />
      <div className="relative flex h-full flex-col items-center justify-between p-4 text-center">
        <span className="self-start text-xs font-black text-amber-100">{String(card.id).padStart(2, "0")}</span>
        <span className={cn("text-5xl text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.55)]", active && "scale-110")}>
          {card.symbol}
        </span>
        <div>
          <p className="text-[10px] font-black tracking-[0.26em] text-amber-100/85">{card.englishName}</p>
          <p className="mt-1 text-lg font-black text-white">{card.name}</p>
        </div>
      </div>
    </div>
  );
}

function FortuneResult({ card, onReset }: { card: FortuneCard; onReset: () => void }) {
  return (
    <div className="ai-fortune-result absolute left-1/2 top-1/2 z-30 w-[min(92vw,430px)] rounded-[2rem] border border-amber-200/45 bg-slate-950/88 p-5 text-white shadow-[0_0_86px_rgba(251,191,36,0.32)] backdrop-blur-xl">
      <div className={cn("rounded-[1.45rem] bg-gradient-to-br p-[1px]", card.gradient)}>
        <div className="rounded-[1.4rem] bg-slate-950/88 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.26em] text-amber-200">{String(card.id).padStart(2, "0")} / {card.englishName}</p>
              <h3 className="mt-2 text-3xl font-black">{card.name}</h3>
            </div>
            <span className="text-4xl">{card.symbol}</span>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4">
            <p className="text-sm font-black text-amber-100">今日主题：{card.theme}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {card.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-violet-100">
                  {keyword}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-7 text-violet-50/86">{card.advice}</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold">
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-violet-200/70">幸运色</p>
              <p className="mt-1 text-amber-100">{card.luckyColor}</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-violet-200/70">数字</p>
              <p className="mt-1 text-amber-100">{card.luckyNumber}</p>
            </div>
            <div className="rounded-2xl bg-white/8 p-3">
              <p className="text-violet-200/70">行动</p>
              <p className="mt-1 text-amber-100">{card.action}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-violet-800"
          >
            <RotateCcw className="h-4 w-4" />
            重新抽卡
          </button>
        </div>
      </div>
    </div>
  );
}

function getOrbitOffset(index: number, activeIndex: number, total: number) {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return Math.max(-5, Math.min(5, offset));
}

function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
