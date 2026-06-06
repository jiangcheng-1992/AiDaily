import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { AiGamePlayground } from "./playground-client";

const gameIds = new Set([
  "tiny-ai-game-lab",
  "ai-snake-training-lab",
  "prompt-adventure-game-builder",
  "ai-prompt-battle-arena",
  "ai-dungeon-master-demo",
  "ai-drawing-guess-game",
]);

export default async function InterestingGamePlaygroundPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  if (!gameIds.has(gameId)) notFound();

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <Link
        href="/interesting?tab=game"
        className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-soft transition-colors hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        返回游戏列表
      </Link>

      <Card className="overflow-hidden rounded-[2rem] bg-white/95 p-0 shadow-lift">
        <AiGamePlayground gameId={gameId} />
      </Card>
    </div>
  );
}
