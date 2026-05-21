type MiniMaxChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

const defaultMiniMaxBaseUrl = "https://api.minimaxi.com/v1";
const defaultMiniMaxModel = "MiniMax-M2.5";

export function hasMiniMaxTextAccess() {
  return Boolean(process.env.MINIMAX_API_KEY?.trim());
}

export function getMiniMaxTextStatus() {
  return {
    backend: hasMiniMaxTextAccess() ? ("minimax" as const) : ("local" as const),
    model: process.env.MINIMAX_TEXT_MODEL?.trim() || defaultMiniMaxModel,
    configured: hasMiniMaxTextAccess(),
  };
}

export async function generateMiniMaxText({
  systemPrompt,
  userPrompt,
  temperature = 0.3,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}) {
  const apiKey = process.env.MINIMAX_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(
      `${process.env.MINIMAX_BASE_URL?.trim() || defaultMiniMaxBaseUrl}/chat/completions`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.MINIMAX_TEXT_MODEL?.trim() || defaultMiniMaxModel,
          temperature: clampTemperature(temperature),
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax returned HTTP ${response.status}: ${errorText.slice(0, 240)}`);
    }

    const data = (await response.json()) as MiniMaxChatCompletionResponse;
    return sanitizeMiniMaxText(extractChatCompletionText(data));
  } finally {
    clearTimeout(timeout);
  }
}

function extractChatCompletionText(response: MiniMaxChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => item.text ?? "")
      .join("\n")
      .trim();
    if (text) return text;
  }

  throw new Error("MiniMax response did not include message content");
}

function sanitizeMiniMaxText(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

function clampTemperature(value: number) {
  if (!Number.isFinite(value)) return 0.3;
  if (value <= 0) return 0.1;
  if (value > 1) return 1;
  return value;
}
