import {
  aiCommentRoles,
  createAiComment,
  generateAiCommentsForPost,
  selectRolesForPost,
} from "@/lib/ai-comment-roles";
import type { Comment, Post } from "@/lib/mock-data";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
};

type RoleCommentPayload = {
  comments: Array<{
    roleId: string;
    content: string;
  }>;
};

export async function generateProductionAiComments({
  post,
  existingRoleIds = [],
}: {
  post: Post;
  existingRoleIds?: string[];
}): Promise<{ provider: "openai" | "local"; comments: Comment[] }> {
  const roles = selectRolesForPost(post).filter(
    (role) => !existingRoleIds.includes(role.id),
  );

  if (!roles.length) {
    return { provider: "local", comments: [] };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      provider: "local",
      comments: generateAiCommentsForPost(post, existingRoleIds),
    };
  }

  try {
    const payload = await generateWithOpenAI(post, roles);
    const comments = payload.comments
      .map((item, index) => {
        const role = roles.find((candidate) => candidate.id === item.roleId);
        if (!role || !item.content?.trim()) return null;

        return createAiComment({
          post,
          role,
          content: item.content.trim().slice(0, 360),
          index,
        });
      })
      .filter((comment): comment is Comment => Boolean(comment));

    if (comments.length) return { provider: "openai", comments };
  } catch (error) {
    console.warn("AI comment generation fell back to local templates", error);
  }

  return {
    provider: "local",
    comments: generateAiCommentsForPost(post, existingRoleIds),
  };
}

async function generateWithOpenAI(
  post: Post,
  roles: typeof aiCommentRoles,
): Promise<RoleCommentPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_COMMENT_MODEL ?? "gpt-4.1-mini",
        instructions:
          "你是「AI圈」社区的 AI 评论生成器。请用中文生成像真实社区用户写出的短评论，必须直接表达观点和判断，具体、克制、有信息量。不要营销腔，不要编造外部事实，不要空话套话。每条评论都必须紧扣这篇内容里已经出现的具体事实、动作、数字或限制，不能写成放在哪篇文章都成立的万能评论。",
        input: buildPrompt(post, roles),
        text: {
          format: {
            type: "json_schema",
            name: "ai_circle_role_comments",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["comments"],
              properties: {
                comments: {
                  type: "array",
                  minItems: 1,
                  maxItems: roles.length,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["roleId", "content"],
                    properties: {
                      roleId: {
                        type: "string",
                        enum: roles.map((role) => role.id),
                      },
                      content: {
                        type: "string",
                        minLength: 24,
                        maxLength: 220,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const parsed = parseRoleCommentPayload(extractResponseText(data));

    if (!Array.isArray(parsed.comments)) {
      throw new Error("OpenAI response did not include comments array");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPrompt(post: Post, roles: typeof aiCommentRoles) {
  return JSON.stringify({
    task: "请为每个角色生成一条 AI圈 帖子评论。",
    constraints: [
      "只评论帖子中已经给出的信息，不扩展未经证实的事实。",
      "评论应像真实中文社区用户，而不是公告、广告或新闻稿。",
      "每条评论 80 到 160 个中文字符左右。",
      "每条评论必须锚定至少 1 个文中已经出现的具体动作、限制、数字、结果或业务变化来分析。",
      "每条评论开头就要切进事实本身，不能先说空泛态度，例如不要先写“这很值得关注”“我更关心的是”。",
      "评论里要体现这个角色最在意的判断角度，例如产品价值、可复现性、增长、风险等，但必须围绕文中事实展开。",
      "不同角色的评论必须明显不是一个模版改词，句式、抓取事实和判断重点都要拉开。",
      "不要重复标题，不要只说‘值得关注’‘很重要’这类空泛判断。",
      "不要复述摘要和正文，不要把原文换个说法重写一遍，直接输出你的判断和立场。",
      "如果文中事实不足以支撑某个强判断，就明确指出信息还不够，不要硬写结论。",
    ],
    post: {
      title: post.title,
      type: post.type,
      summary: post.summary,
      content: post.content,
      whyItMatters: post.whyItMatters,
      editorComment: post.editorComment,
      tags: post.tags,
      sourceName: post.sourceName,
    },
    grounding: {
      requiredStyle:
        "先抓住文里的具体事实，再给出判断。评论必须让人一眼看出你是在评论这篇文章，而不是任意一篇 AI 新闻；最好直接点出文里那个动作、数字、限制或结果。",
    },
    roles: roles.map((role) => ({
      roleId: role.id,
      name: role.name,
      title: role.title,
      focus: role.focus,
      angleInstruction: buildRoleAngleInstruction(role.id),
    })),
    outputShape: {
      comments: [
        {
          roleId: roles[0]?.id ?? "role-id",
          content: "一条中文评论",
        },
      ],
    },
  });
}

function buildRoleAngleInstruction(roleId: string) {
  switch (roleId) {
    case "product-strategist":
      return "抓产品是否真的改了一段用户流程，是否能转成付费、交付或更高留存。";
    case "indie-hacker":
      return "抓最适合先做成 MVP 的窄环节，评估是否能省时间、降成本、少返工。";
    case "research-reader":
      return "抓证据强度、评测口径、失败边界和可复现性，不要轻信结论。";
    case "growth-operator":
      return "抓用户是否能快速感知收益，是否有传播、转化、留存上的放大点。";
    case "creator-coach":
      return "抓这条内容能不能被拆成创作方法、案例框架或可执行建议。";
    case "risk-observer":
      return "抓合规、质量控制、权限、成本失控和预期过热的风险。";
    default:
      return "必须从角色视角做判断。";
  }
}

function extractResponseText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  const text = response.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");

  if (!text) throw new Error("OpenAI response did not include text output");
  return text;
}

function parseRoleCommentPayload(value: string): RoleCommentPayload {
  const cleanValue = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleanValue) as RoleCommentPayload;
}
