"use client";

import type { LucideIcon } from "lucide-react";

import { cn, formatCompactNumber } from "@/lib/utils";

export function InteractionButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-700",
        active && "bg-blue-50 text-blue-700",
      )}
      aria-label={label}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "fill-current")} />
      <span className="truncate">{count === undefined ? label : formatCompactNumber(count)}</span>
    </button>
  );
}
