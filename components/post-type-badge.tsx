import type { PostType } from "@/lib/mock-data";
import { postTypeMeta } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const toneClass: Record<PostType, string> = {
  news: "bg-blue-50 text-blue-700 ring-blue-100",
  opinion: "bg-violet-50 text-violet-700 ring-violet-100",
  tool: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  skill: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  product: "bg-amber-50 text-amber-700 ring-amber-100",
  case: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function PostTypeBadge({
  type,
  className,
}: {
  type: PostType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1",
        toneClass[type],
        className,
      )}
    >
      {postTypeMeta[type].label}
    </span>
  );
}
