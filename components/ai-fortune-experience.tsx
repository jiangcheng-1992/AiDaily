"use client";

import { Stars, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Radar,
  RotateCcw,
  ScanLine,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

import { playAudioFx } from "@/lib/audio-fx";
import { fortuneCards, pickDailyFortuneCard, type FortuneCard } from "@/lib/fortune-data";
import {
  createHandGestureRecognizer,
  isFocusGesture,
  isSelectGesture,
  readHandGesture,
  type HandGestureRecognizer,
  type HandGestureSnapshot,
} from "@/lib/gesture-utils";
import { cn } from "@/lib/utils";

type RitualPhase = "intro" | "scanning" | "cards" | "revealing" | "result";
type GestureEngineState = {
  status: "idle" | "loading" | "ready" | "fallback" | "error";
  message: string;
  gesture?: string;
};

export type AiFortuneExperienceProps = {
  className?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  symbol?: string;
  renderTrigger?: (open: () => void) => ReactNode;
  onOpenChange?: (open: boolean) => void;
};

export function AiFortuneExperience({
  className,
  eyebrow = "今日 AI 运势",
  title = "唤醒你的灵感卡",
  description = "摄像头能量场、悬浮卡牌和星光揭示，抽取今天最适合你的 AI 灵感建议。",
  ctaLabel = "开启仪式",
  symbol = "✦",
  renderTrigger,
  onOpenChange,
}: AiFortuneExperienceProps = {}) {
  const [open, setOpen] = useState(false);

  function openExperience() {
    setOpen(true);
    onOpenChange?.(true);
  }

  function closeExperience() {
    setOpen(false);
    onOpenChange?.(false);
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openExperience)
      ) : (
        <button
          type="button"
          onClick={openExperience}
          className={cn(
            "group relative w-full overflow-hidden rounded-3xl border border-violet-200/70 bg-slate-950 p-5 text-left text-white shadow-soft transition-transform hover:-translate-y-0.5 hover:shadow-lift",
            className,
          )}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(168,85,247,0.65),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.32),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(88,28,135,0.9))]" />
          <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-2xl transition-transform group-hover:scale-125" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black text-cyan-100 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              {eyebrow}
            </div>
            <h3 className="text-xl font-black tracking-normal">{title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-violet-100/82">
              {description}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-black text-violet-700">
                {ctaLabel}
                <WandSparkles className="h-4 w-4" />
              </span>
              <span className="text-3xl">{symbol}</span>
            </div>
          </div>
        </button>
      )}
      {open ? <AiFortuneModal onClose={closeExperience} /> : null}
    </>
  );
}

export function AiFortuneEntry(props: AiFortuneExperienceProps) {
  return <AiFortuneExperience {...props} />;
}

export function AiFortuneModal({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognizerRef = useRef<HandGestureRecognizer | null>(null);
  const gestureFrameRef = useRef<number | null>(null);
  const lastGestureRef = useRef<{
    anchorAt: number;
    anchorX: number;
    x: number;
    at: number;
    lastSwipeAt: number;
    lastRevealAt: number;
    focusedSince: number;
  } | null>(null);
  const [phase, setPhase] = useState<RitualPhase>("intro");
  const [cameraError, setCameraError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => pickDailyFortuneCard().id - 1);
  const [selectedCard, setSelectedCard] = useState<FortuneCard | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50, active: false });
  const [gestureEngine, setGestureEngine] = useState<GestureEngineState>({
    status: "idle",
    message: "等待摄像头唤醒手势识别。",
  });
  const activeIndexRef = useRef(activeIndex);
  const phaseRef = useRef(phase);
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
      if (gestureFrameRef.current) cancelAnimationFrame(gestureFrameRef.current);
      recognizerRef.current?.close?.();
      stopCamera(streamRef.current);
    };
  }, []);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
      void initializeGestureRecognition();
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

  function rotateCardsByGesture(direction: -1 | 1) {
    if (phaseRef.current === "revealing" || phaseRef.current === "result") return;

    setPhase("cards");
    setActiveIndex((current) => (current + direction + cards.length) % cards.length);
    playAudioFx("move");
  }

  function revealActiveCardByGesture() {
    if (phaseRef.current === "revealing" || phaseRef.current === "result") return;

    const card = cards[activeIndexRef.current] ?? cards[0];
    revealCard(card);
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

  async function initializeGestureRecognition() {
    if (!videoRef.current) return;

    setGestureEngine({
      status: "loading",
      message: "正在加载 MediaPipe 手势识别模型...",
    });

    try {
      recognizerRef.current = await createHandGestureRecognizer();
      setGestureEngine({
        status: "ready",
        message: "手势识别已连接：左右挥手切换，握拳/点赞/V 手势揭牌。",
      });
      runGestureLoop();
    } catch {
      setGestureEngine({
        status: "fallback",
        message: "MediaPipe 加载失败，已降级为鼠标/触摸控制。",
      });
    }
  }

  function runGestureLoop() {
    if (!recognizerRef.current || !videoRef.current) return;

    const snapshot = readHandGesture(recognizerRef.current, videoRef.current);
    if (snapshot) handleGestureSnapshot(snapshot);
    gestureFrameRef.current = window.requestAnimationFrame(runGestureLoop);
  }

  function handleGestureSnapshot(snapshot: HandGestureSnapshot) {
    const now = performance.now();
    const xPercent = snapshot.x * 100;
    const yPercent = snapshot.y * 100;

    setCursor({ x: xPercent, y: yPercent, active: true });
    setGestureEngine({
      status: "ready",
      message: isSelectGesture(snapshot.gesture)
        ? "检测到选择手势，正在打开当前灵感卡..."
        : isFocusGesture(snapshot.gesture)
          ? "检测到手掌能量场，当前卡牌正在聚焦。"
          : "移动手掌控制卡牌宇宙，握拳/点赞/V 手势揭示卡牌。",
      gesture: formatGestureName(snapshot.gesture),
    });

    const previous = lastGestureRef.current;
    if (!previous) {
      lastGestureRef.current = {
        anchorAt: now,
        anchorX: snapshot.x,
        x: snapshot.x,
        at: now,
        lastSwipeAt: 0,
        lastRevealAt: 0,
        focusedSince: isFocusGesture(snapshot.gesture) ? now : 0,
      };
      return;
    }

    const deltaX = snapshot.x - previous.anchorX;
    const elapsed = Math.max(16, now - previous.anchorAt);
    const velocity = deltaX / elapsed;

    if (Math.abs(deltaX) > 0.12 && Math.abs(velocity) > 0.00055 && now - previous.lastSwipeAt > 650) {
      rotateCardsByGesture(deltaX > 0 ? 1 : -1);
      previous.lastSwipeAt = now;
      previous.anchorX = snapshot.x;
      previous.anchorAt = now;
    } else if (elapsed > 520) {
      previous.anchorX = snapshot.x;
      previous.anchorAt = now;
    }

    if (isFocusGesture(snapshot.gesture)) {
      previous.focusedSince ||= now;
      if (now - previous.focusedSince > 850 && now - previous.lastSwipeAt > 600) {
        playAudioFx("focus");
        previous.focusedSince = now + 999999;
      }
    } else {
      previous.focusedSince = 0;
    }

    const confidentSelect = snapshot.gesture === "Ok_Sign" || snapshot.score > 0.45;
    if (isSelectGesture(snapshot.gesture) && now - previous.lastRevealAt > 1800 && confidentSelect) {
      previous.lastRevealAt = now;
      revealActiveCardByGesture();
    }

    previous.x = snapshot.x;
    previous.at = now;
  }

  return (
    <div
      className="fixed inset-0 z-[120] overflow-hidden bg-slate-950 text-white"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setCursor((current) => ({ ...current, active: false }))}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(217,70,239,0.36),transparent_32%),radial-gradient(circle_at_15%_72%,rgba(14,165,233,0.24),transparent_30%),radial-gradient(circle_at_84%_66%,rgba(251,191,36,0.16),transparent_24%),linear-gradient(135deg,#020617,#13071f_42%,#2e1065_72%,#020617)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />
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
        className="pointer-events-none absolute z-20 hidden h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/75 bg-cyan-300/10 shadow-[0_0_54px_rgba(34,211,238,0.72)] md:block"
        style={{
          left: `${cursor.x}%`,
          top: `${cursor.y}%`,
          opacity: cursor.active ? 1 : 0,
        }}
      />

      <div className="relative z-10 flex h-full flex-col overflow-y-auto px-4 py-5 sm:px-8">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-1 flex-col gap-5">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-white/10 px-4 py-1.5 text-xs font-black text-amber-100 backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-amber-200" />
              AI 灵感召唤仪式
            </div>
            <h2 className="mt-4 bg-gradient-to-r from-white via-violet-100 to-amber-100 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
              用手操控悬浮的魔法卡牌
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-violet-100/75">
              左右挥手切换卡牌，握拳/点赞/V 手势揭示今日灵感。摄像头画面仅在本地识别，不上传、不保存。
            </p>
          </div>

          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(320px,0.78fr)_minmax(0,1.22fr)]">
            <div className="relative min-h-[430px] overflow-hidden rounded-[2.2rem] border border-cyan-200/18 bg-white/8 p-3 shadow-[0_0_90px_rgba(6,182,212,0.18)] backdrop-blur-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(180deg,rgba(168,85,247,0.14),rgba(2,6,23,0.55))]" />
              <video
                ref={videoRef}
                playsInline
                muted
                className={cn(
                  "relative h-full min-h-[430px] w-full scale-x-[-1] rounded-[1.75rem] object-cover opacity-62 saturate-150",
                  cameraOn ? "block" : "hidden",
                )}
              />
              {!cameraOn ? (
                <div className="relative flex h-full min-h-[430px] flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-cyan-200/25 bg-slate-950/45 text-center">
                  <div className="absolute h-56 w-56 rounded-full border border-cyan-200/20 shadow-[0_0_68px_rgba(34,211,238,0.22)] ai-fortune-spin" />
                  <Camera className="relative h-14 w-14 text-cyan-200 drop-shadow-[0_0_24px_rgba(34,211,238,0.65)]" />
                  <p className="relative mt-5 text-xl font-black">摄像头能量场待开启</p>
                  <p className="relative mt-2 max-w-sm text-sm leading-6 text-violet-100/65">
                    开启后 MediaPipe 会识别手掌、挥手与选择手势，用你的手控制卡牌宇宙。
                  </p>
                </div>
              ) : null}
              {cameraOn && cursor.active ? (
                <div
                  className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70 bg-cyan-300/10 shadow-[0_0_45px_rgba(34,211,238,0.78)]"
                  style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
                >
                  <span className="absolute inset-3 rounded-full border border-amber-200/45" />
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] bg-gradient-to-br from-violet-700/26 via-transparent to-cyan-500/20" />
              <div className="pointer-events-none absolute inset-5 rounded-[1.45rem] border border-cyan-200/24 shadow-[inset_0_0_52px_rgba(34,211,238,0.14)]" />
              <div className="absolute left-5 right-5 top-5 flex flex-wrap items-center gap-2">
                <GestureBadge engine={gestureEngine} />
              </div>
              <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-cyan-100/15 bg-slate-950/68 p-3 text-xs font-semibold leading-5 text-violet-100 shadow-[0_0_28px_rgba(34,211,238,0.12)] backdrop-blur-xl">
                {phase === "intro"
                  ? "点击开启摄像头，进入今日 AI 灵感仪式。"
                  : phase === "scanning"
                    ? "正在连接手势识别模型与今日灵感频率..."
                    : gestureEngine.message}
                {cameraError ? <span className="mt-1 block text-amber-200">{cameraError}</span> : null}
              </div>
            </div>

            <div className="relative flex min-h-[520px] items-center justify-center overflow-hidden rounded-[2.2rem] border border-amber-200/14 bg-slate-950/46 shadow-[0_0_110px_rgba(88,28,135,0.32)] backdrop-blur-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.13),transparent_18%),radial-gradient(circle_at_center,rgba(168,85,247,0.36),transparent_48%)]" />
              <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/10 shadow-[0_0_90px_rgba(168,85,247,0.28)] ai-fortune-spin" />
              <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-200/12 shadow-[0_0_60px_rgba(251,191,36,0.16)] ai-fortune-spin-reverse" />
              {phase === "intro" ? (
                <div className="relative z-10 max-w-md px-6 text-center">
                  <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full border border-amber-200/35 bg-amber-200/10 shadow-[0_0_80px_rgba(251,191,36,0.38)]">
                    <WandSparkles className="h-10 w-10 text-amber-200" />
                  </div>
                  <button
                    type="button"
                    onClick={startRitual}
                    className="rounded-full bg-gradient-to-r from-amber-100 via-white to-cyan-100 px-8 py-4 text-sm font-black text-violet-900 shadow-[0_0_42px_rgba(255,255,255,0.28)] transition-transform hover:scale-105"
                  >
                    开启摄像头，连接手势魔法
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase("cards")}
                    className="mt-4 block w-full text-xs font-bold text-violet-100/65 underline-offset-4 hover:text-white hover:underline"
                  >
                    跳过手势识别，使用手动抽卡
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
                  <div className="absolute left-5 top-5 z-20 hidden rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-xs font-bold text-violet-100 backdrop-blur md:block">
                    <p className="flex items-center gap-2">
                      <Radar className="h-4 w-4 text-cyan-200" />
                      左右挥手切换
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-violet-200/75">
                      <ScanLine className="h-4 w-4 text-amber-200" />
                      握拳/点赞/V 揭牌
                    </p>
                  </div>
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
        .ai-fortune-spin {
          animation: aiFortuneSpin 24s linear infinite;
        }
        .ai-fortune-spin-reverse {
          animation: aiFortuneSpin 34s linear infinite reverse;
        }
        @keyframes aiFortuneSpin {
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
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
    <div className="relative h-full min-h-[520px] w-full">
      <Canvas
        className="absolute inset-0"
        camera={{ position: [0, 1.1, 8.2], fov: 42 }}
        dpr={[1, 1.7]}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#030712"]} />
        <fog attach="fog" args={["#14051f", 7.5, 15]} />
        <ambientLight intensity={0.72} />
        <pointLight position={[0, 3.8, 3.5]} color="#facc15" intensity={2.1} distance={9} />
        <pointLight position={[-3.5, 1.6, 4]} color="#22d3ee" intensity={1.35} distance={8} />
        <pointLight position={[3.5, -0.8, 2.5]} color="#c084fc" intensity={1.6} distance={8} />
        <Stars radius={18} depth={10} count={900} factor={3.2} fade speed={0.65} />
        <MagicRings />
        <WebGLCardUniverse
          activeIndex={activeIndex}
          cards={cards}
          onReveal={onReveal}
          phase={phase}
          selectedCard={selectedCard}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_38%,rgba(2,6,23,0.54)_86%)]" />
      <div className="pointer-events-none absolute inset-x-10 bottom-8 h-20 rounded-full bg-cyan-400/10 blur-2xl" />
    </div>
  );
}

function WebGLCardUniverse({
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
    <group>
      {cards.map((card, index) => (
        <WebGLFortuneCard
          activeIndex={activeIndex}
          card={card}
          index={index}
          key={card.id}
          onReveal={onReveal}
          phase={phase}
          selectedCard={selectedCard}
          total={cards.length}
        />
      ))}
    </group>
  );
}

function WebGLFortuneCard({
  card,
  index,
  activeIndex,
  total,
  phase,
  selectedCard,
  onReveal,
}: {
  card: FortuneCard;
  index: number;
  activeIndex: number;
  total: number;
  phase: RitualPhase;
  selectedCard: FortuneCard | null;
  onReveal: (card: FortuneCard) => void;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const faceMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const edgeMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const glowMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const palette = useMemo(() => getWebGLCardPalette(card.id), [card.id]);
  const offset = getOrbitOffset(index, activeIndex, total);
  const isActive = offset === 0;
  const isSelected = selectedCard?.id === card.id;

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const absOffset = Math.abs(offset);
    const isRevealing = phase === "revealing";
    const hiddenDuringReveal = isRevealing && !isSelected;
    const floatY = Math.sin(clock.elapsedTime * 1.8 + index) * 0.08;
    const targetPosition = new THREE.Vector3(
      hiddenDuringReveal ? offset * 2.4 : offset * 1.04,
      hiddenDuringReveal ? 0.9 + absOffset * 0.16 : (isActive ? 0.16 : -absOffset * 0.08) + floatY,
      hiddenDuringReveal ? -2.8 : isSelected && isRevealing ? 2.25 : isActive ? 1.45 : -absOffset * 0.46,
    );
    const targetScale = hiddenDuringReveal ? 0.36 : isSelected && isRevealing ? 1.48 : isActive ? 1.16 : Math.max(0.46, 0.92 - absOffset * 0.08);
    const rotationY = isSelected && isRevealing ? Math.sin(clock.elapsedTime * 5.2) * 0.16 : offset * -0.34;
    const rotationZ = hiddenDuringReveal ? offset * 0.28 : offset * -0.045;

    group.position.lerp(targetPosition, Math.min(1, delta * 5.8));
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), Math.min(1, delta * 5.4));
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, rotationY, Math.min(1, delta * 6.2));
    group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, rotationZ, Math.min(1, delta * 5.4));

    const opacity = hiddenDuringReveal ? 0 : Math.max(0.18, 1 - absOffset * 0.16);
    if (faceMaterialRef.current) faceMaterialRef.current.opacity = opacity;
    if (edgeMaterialRef.current) edgeMaterialRef.current.opacity = Math.min(1, opacity + 0.1);
    if (glowMaterialRef.current) glowMaterialRef.current.opacity = isActive ? 0.32 : 0.08;
  });

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        if (isActive && phase !== "revealing" && phase !== "result") onReveal(card);
      }}
    >
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[1.95, 2.85, 1, 1]} />
        <meshBasicMaterial
          ref={glowMaterialRef}
          color={palette.glow}
          depthWrite={false}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.58, 2.34, 0.08, 12, 12, 2]} />
        <meshStandardMaterial
          ref={faceMaterialRef}
          color={palette.base}
          emissive={palette.emissive}
          emissiveIntensity={isActive ? 0.58 : 0.25}
          metalness={0.48}
          opacity={1}
          roughness={0.28}
          transparent
        />
      </mesh>
      <mesh position={[0, 0, 0.058]}>
        <boxGeometry args={[1.66, 2.42, 0.035]} />
        <meshStandardMaterial
          ref={edgeMaterialRef}
          color="#f7d991"
          emissive="#facc15"
          emissiveIntensity={isActive ? 0.38 : 0.12}
          metalness={0.76}
          opacity={0.72}
          roughness={0.2}
          transparent
          wireframe
        />
      </mesh>
      <mesh position={[0, 0.04, 0.09]}>
        <circleGeometry args={[0.48, 64]} />
        <meshBasicMaterial color="#ffffff" opacity={isActive ? 0.16 : 0.08} transparent />
      </mesh>
      <mesh position={[0, 0.04, 0.1]}>
        <torusGeometry args={[0.56, 0.006, 8, 96]} />
        <meshBasicMaterial color="#fde68a" opacity={isActive ? 0.72 : 0.28} transparent />
      </mesh>
      <mesh position={[0, 0.04, 0.11]} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[0.66, 0.004, 8, 96]} />
        <meshBasicMaterial color="#67e8f9" opacity={isActive ? 0.48 : 0.18} transparent />
      </mesh>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#fff7ed"
        fontSize={0.46}
        outlineBlur={0.012}
        outlineColor={palette.glow}
        outlineOpacity={0.55}
        position={[0, 0.08, 0.16]}
      >
        {card.symbol}
      </Text>
      <Text
        anchorX="left"
        anchorY="middle"
        color="#fde68a"
        fontSize={0.105}
        maxWidth={0.65}
        position={[-0.62, 0.96, 0.16]}
      >
        {String(card.id).padStart(2, "0")}
      </Text>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#fde68a"
        fontSize={0.075}
        letterSpacing={0.06}
        maxWidth={1.14}
        position={[0, -0.78, 0.16]}
      >
        {card.englishName}
      </Text>
      <Text
        anchorX="center"
        anchorY="middle"
        color="#ffffff"
        fontSize={0.14}
        maxWidth={1.2}
        position={[0, -0.98, 0.16]}
      >
        {card.name}
      </Text>
    </group>
  );
}

function MagicRings() {
  const outerRef = useRef<THREE.Group | null>(null);
  const innerRef = useRef<THREE.Group | null>(null);

  useFrame((_, delta) => {
    if (outerRef.current) outerRef.current.rotation.z += delta * 0.18;
    if (innerRef.current) innerRef.current.rotation.z -= delta * 0.28;
  });

  return (
    <group position={[0, -0.28, -0.72]} rotation={[Math.PI / 2.08, 0, 0]}>
      <group ref={outerRef}>
        <mesh>
          <torusGeometry args={[2.55, 0.012, 12, 160]} />
          <meshBasicMaterial color="#a78bfa" opacity={0.32} transparent />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <torusGeometry args={[2.08, 0.008, 12, 160]} />
          <meshBasicMaterial color="#22d3ee" opacity={0.28} transparent />
        </mesh>
      </group>
      <group ref={innerRef}>
        <mesh>
          <torusGeometry args={[1.16, 0.01, 12, 128]} />
          <meshBasicMaterial color="#fde68a" opacity={0.36} transparent />
        </mesh>
        {Array.from({ length: 12 }, (_, index) => (
          <mesh
            key={index}
            position={[
              Math.cos((index / 12) * Math.PI * 2) * 1.48,
              Math.sin((index / 12) * Math.PI * 2) * 1.48,
              0,
            ]}
          >
            <sphereGeometry args={[0.025, 10, 10]} />
            <meshBasicMaterial color={index % 2 ? "#fef3c7" : "#67e8f9"} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function GestureBadge({ engine }: { engine: GestureEngineState }) {
  const isReady = engine.status === "ready";
  const isLoading = engine.status === "loading";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black backdrop-blur-xl",
        isReady
          ? "border-cyan-200/35 bg-cyan-300/12 text-cyan-100"
          : isLoading
            ? "border-amber-200/35 bg-amber-200/12 text-amber-100"
            : "border-white/12 bg-white/10 text-violet-100",
      )}
    >
      {isReady ? <Radar className="h-3.5 w-3.5" /> : <ScanLine className="h-3.5 w-3.5" />}
      {isReady ? `已识别：${engine.gesture ?? "手掌"}` : engine.message}
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

function getWebGLCardPalette(cardId: number) {
  const palettes = [
    { base: "#4f46e5", emissive: "#7c3aed", glow: "#a78bfa" },
    { base: "#0891b2", emissive: "#0e7490", glow: "#67e8f9" },
    { base: "#7c3aed", emissive: "#581c87", glow: "#c084fc" },
    { base: "#ea580c", emissive: "#f59e0b", glow: "#fde68a" },
    { base: "#db2777", emissive: "#be185d", glow: "#f9a8d4" },
    { base: "#2563eb", emissive: "#1d4ed8", glow: "#93c5fd" },
    { base: "#475569", emissive: "#0f172a", glow: "#e2e8f0" },
    { base: "#be123c", emissive: "#9f1239", glow: "#fda4af" },
    { base: "#92400e", emissive: "#78350f", glow: "#fcd34d" },
    { base: "#059669", emissive: "#047857", glow: "#6ee7b7" },
    { base: "#312e81", emissive: "#1e1b4b", glow: "#818cf8" },
    { base: "#0369a1", emissive: "#075985", glow: "#7dd3fc" },
  ];

  return palettes[(cardId - 1) % palettes.length] ?? palettes[0];
}

function formatGestureName(gesture: string) {
  switch (gesture) {
    case "Open_Palm":
      return "张开手掌";
    case "Closed_Fist":
      return "握拳";
    case "Ok_Sign":
      return "OK";
    case "Thumb_Up":
      return "点赞";
    case "Victory":
      return "V 手势";
    case "Pointing_Up":
      return "指向";
    case "ILoveYou":
      return "选择";
    default:
      return "手掌";
  }
}

function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
