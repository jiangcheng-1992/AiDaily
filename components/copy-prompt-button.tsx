"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyPromptButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(prompt);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "已复制" : "复制 Prompt"}
    </button>
  );
}
