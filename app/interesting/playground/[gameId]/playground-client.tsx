"use client";

import { useMemo, useState } from "react";
import { Bot, Dice5, RotateCcw, Sparkles, Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type GameConfig = {
  title: string;
  subtitle: string;
  promptLabel: string;
  placeholder: string;
  goal: string;
  choices: Array<{ label: string; delta: number; note: string }>;
  events: string[];
};

const games: Record<string, GameConfig> = {
  "tiny-ai-game-lab": {
    title: "一句话生成可玩的网页小游戏",
    subtitle: "输入玩法，AI 会生成关卡目标，你通过选择迭代方向把原型打磨到可发布。",
    promptLabel: "小游戏创意",
    placeholder: "例如：一只会收集灵感碎片的猫，需要躲开拖延怪",
    goal: "把原型完成度提升到 100",
    choices: [
      { label: "生成核心玩法", delta: 18, note: "AI 把一句话拆成目标、障碍和胜利条件。" },
      { label: "补一关教学", delta: 14, note: "新手引导变清楚了，玩家更容易上手。" },
      { label: "加反馈音效", delta: 10, note: "操作反馈更强，小游戏开始有爽感。" },
    ],
    events: ["生成了一个 Canvas 原型", "AI 建议把失败条件提前说明", "导出 HTML 代码成功"],
  },
  "ai-snake-training-lab": {
    title: "AI 贪吃蛇训练实验室",
    subtitle: "选择训练策略，让小蛇从乱走逐步学会吃豆和避墙。",
    promptLabel: "训练目标",
    placeholder: "例如：优先吃近处豆子，同时避开自己的身体",
    goal: "把模型表现提升到 100",
    choices: [
      { label: "奖励吃豆", delta: 16, note: "小蛇更愿意靠近食物了。" },
      { label: "惩罚撞墙", delta: 15, note: "模型开始避开边界。" },
      { label: "增加探索率", delta: 11, note: "小蛇尝试了更多路线。" },
    ],
    events: ["第 1 轮：随机游走", "第 8 轮：开始绕开墙壁", "第 21 轮：连续吃到 3 个豆子"],
  },
  "prompt-adventure-game-builder": {
    title: "Prompt 文字冒险生成器",
    subtitle: "用世界观和角色 Prompt 生成分支剧情，边玩边调整故事走向。",
    promptLabel: "世界观设定",
    placeholder: "例如：赛博竹林里，玩家要找回失控的灵感引擎",
    goal: "把剧情完成度提升到 100",
    choices: [
      { label: "生成分支选择", delta: 16, note: "玩家现在有了 3 条不同路线。" },
      { label: "强化角色动机", delta: 13, note: "NPC 的行动更合理了。" },
      { label: "添加反转结局", delta: 15, note: "故事最后出现了意外但合理的反转。" },
    ],
    events: ["AI 生成了开场白", "新增一个关键道具", "结局根据玩家选择发生变化"],
  },
  "ai-prompt-battle-arena": {
    title: "AI Prompt 对战小剧场",
    subtitle: "用 Prompt 指挥角色对战，目标越明确，回合结果越有优势。",
    promptLabel: "战斗 Prompt",
    placeholder: "例如：用最少行动封锁对手路线，并保护自己的能量核心",
    goal: "把胜率提升到 100",
    choices: [
      { label: "明确胜利目标", delta: 17, note: "角色行动更聚焦，减少无效操作。" },
      { label: "加入约束条件", delta: 14, note: "Prompt 避免了过度消耗资源。" },
      { label: "预测对手动作", delta: 12, note: "成功拦截了一次突进。" },
    ],
    events: ["第 1 回合：双方试探", "第 2 回合：Prompt 命中弱点", "第 3 回合：AI 判定你获得优势"],
  },
  "ai-dungeon-master-demo": {
    title: "AI 地牢主持人 Demo",
    subtitle: "AI 扮演主持人，根据你的选择生成事件、道具和风险。",
    promptLabel: "冒险目标",
    placeholder: "例如：进入废弃模型训练场，找回被污染的数据水晶",
    goal: "把冒险推进度提升到 100",
    choices: [
      { label: "调查房间", delta: 12, note: "你发现了一段隐藏日志。" },
      { label: "说服守卫", delta: 15, note: "AI 生成了一段可通过的对话。" },
      { label: "冒险开宝箱", delta: 18, note: "获得稀有道具，但风险上升。" },
    ],
    events: ["主持人生成了地图", "遭遇一个会提问的石像", "你的选择改变了下一幕敌人"],
  },
  "ai-drawing-guess-game": {
    title: "AI 你画我猜挑战",
    subtitle: "输入线索模拟画作，AI 根据特征猜答案，越具体越容易命中。",
    promptLabel: "画面线索",
    placeholder: "例如：圆圆的身体、两只耳朵、手里拿着发光键盘",
    goal: "把识别相似度提升到 100",
    choices: [
      { label: "补充轮廓", delta: 15, note: "AI 更容易识别主体形状。" },
      { label: "添加关键特征", delta: 17, note: "猜测范围明显缩小。" },
      { label: "减少干扰元素", delta: 12, note: "模型注意力集中到目标上。" },
    ],
    events: ["AI 猜测：机器人", "AI 猜测：拿键盘的猫", "相似度继续上升"],
  },
};

export function AiGamePlayground({ gameId }: { gameId: string }) {
  const config = games[gameId] ?? games["tiny-ai-game-lab"];
  const [prompt, setPrompt] = useState("");
  const [score, setScore] = useState(24);
  const [turn, setTurn] = useState(1);
  const [logs, setLogs] = useState<string[]>(() => [config.events[0]]);

  const level = useMemo(() => {
    if (score >= 100) return "已通关";
    if (score >= 72) return "高能阶段";
    if (score >= 45) return "成型中";
    return "原型阶段";
  }, [score]);

  function playChoice(choice: GameConfig["choices"][number]) {
    const promptBonus = Math.min(10, Math.floor(prompt.trim().length / 8));
    const nextScore = Math.min(100, score + choice.delta + promptBonus);
    const event = config.events[turn % config.events.length];

    setScore(nextScore);
    setTurn((value) => value + 1);
    setLogs((current) => [
      `第 ${turn} 回合：${choice.note}${promptBonus ? ` Prompt 加成 +${promptBonus}` : ""}`,
      event,
      ...current,
    ].slice(0, 6));
  }

  function resetGame() {
    setScore(24);
    setTurn(1);
    setLogs([config.events[0]]);
  }

  return (
    <div className="bg-slate-950 text-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-h-[560px] p-4 sm:p-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-black text-blue-100">
            <Sparkles className="h-4 w-4" />
            AI 圈站内小游戏
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-[-0.04em] sm:text-4xl">{config.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{config.subtitle}</p>

          <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-400">{config.goal}</div>
                <div className="mt-1 text-lg font-black">{level}</div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-slate-950">
                {score}
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 via-fuchsia-400 to-amber-300 transition-all duration-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <label className="mt-6 block text-sm font-black text-slate-200">{config.promptLabel}</label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={config.placeholder}
            className="mt-3 min-h-28 w-full rounded-3xl border border-white/10 bg-white/[0.07] p-4 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-blue-300"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {config.choices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                onClick={() => playChoice(choice)}
                disabled={score >= 100}
                className={cn(
                  "rounded-3xl bg-white px-4 py-4 text-left text-sm font-black text-slate-950 transition-transform hover:-translate-y-0.5",
                  score >= 100 && "cursor-not-allowed opacity-60 hover:translate-y-0",
                )}
              >
                <Dice5 className="mb-3 h-5 w-5 text-blue-600" />
                {choice.label}
                <div className="mt-2 text-xs font-bold leading-5 text-slate-500">+{choice.delta} 基础收益</div>
              </button>
            ))}
          </div>
        </main>

        <aside className="border-t border-white/10 bg-white/[0.04] p-4 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-slate-200">
              <Bot className="h-4 w-4" />
              AI 裁判日志
            </div>
            <button
              type="button"
              onClick={resetGame}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-950"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重开
            </button>
          </div>

          {score >= 100 ? (
            <div className="mt-5 rounded-3xl bg-amber-300 p-4 text-slate-950">
              <Trophy className="h-7 w-7" />
              <div className="mt-2 text-lg font-black">通关成功</div>
              <p className="mt-1 text-sm font-semibold leading-6">这个原型已经达到可展示状态，可以重开换一个 Prompt 继续试。</p>
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {logs.map((log, index) => (
              <div key={`${log}-${index}`} className="rounded-3xl bg-white/[0.07] p-4 text-sm font-semibold leading-6 text-slate-200">
                {log}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
