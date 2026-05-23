import type { Post } from "@/lib/mock-data";
import { calculatePostScore } from "@/lib/post-score";
import { cn } from "@/lib/utils";

export function PostScoreBadge({
  post,
  size = "default",
  className,
}: {
  post: Post;
  size?: "default" | "compact";
  className?: string;
}) {
  const score = calculatePostScore(post);

  return (
    <span
      className={cn(
        "shrink-0 bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-soft",
        size === "compact"
          ? "inline-flex h-8 min-w-8 items-center justify-center rounded-xl px-1.5 text-[12px] font-black"
          : "flex h-10 w-10 flex-col items-center justify-center rounded-2xl",
        className,
      )}
      title="综合评分：基于专业性、热点、创作者/来源和互动信号"
    >
      {size === "compact" ? (
        score.toFixed(1)
      ) : (
        <>
          <span className="text-[13px] font-black leading-none">{score.toFixed(1)}</span>
          <span className="mt-0.5 text-[9px] font-bold leading-none text-white/75">评分</span>
        </>
      )}
    </span>
  );
}
