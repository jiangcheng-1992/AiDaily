import {
  aiCommentRoles,
  createAiComment,
  selectRolesForPost,
} from "@/lib/ai-comment-roles";
import { generateMiniMaxText, hasMiniMaxTextAccess } from "@/lib/minimax-text";
import type { Comment, Post } from "@/lib/mock-data";

type RoleCommentPayload = {
  comments: Array<{
    roleId: string;
    content: string;
  }>;
};

export type ProductionAiCommentResult = {
  provider: "minimax" | "unavailable";
  comments: Comment[];
  error?: string;
  skipped?: boolean;
};

export async function generateProductionAiComments({
  post,
  existingRoleIds = [],
}: {
  post: Post;
  existingRoleIds?: string[];
}): Promise<ProductionAiCommentResult> {
  const roles = selectRolesForPost(post).filter(
    (role) => !existingRoleIds.includes(role.id),
  );

  if (!roles.length) {
    return { provider: "unavailable", comments: [], skipped: true };
  }

  if (!hasMiniMaxTextAccess()) {
    return { provider: "unavailable", comments: [], error: "MINIMAX_API_KEY is not configured" };
  }

  try {
    const payload = await generateWithMiniMax(post, roles);
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

    if (comments.length) {
      return { provider: "minimax", comments };
    }

    return {
      provider: "unavailable",
      comments: [],
      error: "MiniMax returned no usable grounded comments",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "MiniMax comment generation failed";
    console.warn("MiniMax comment generation failed", {
      postId: post.id,
      sourceName: post.sourceName,
      error: message,
    });
    return {
      provider: "unavailable",
      comments: [],
      error: message,
    };
  }
}

async function generateWithMiniMax(
  post: Post,
  roles: typeof aiCommentRoles,
): Promise<RoleCommentPayload> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const text = await generateMiniMaxText({
        systemPrompt:
          "你是「AI圈」社区的 AI 评论生成器。请用中文生成像真实社区用户写出的短评论，必须直接表达观点和判断，具体、克制、有信息量。不要营销腔，不要编造外部事实，不要空话套话。每条评论都必须紧扣这篇内容里已经出现的具体事实、动作、数字或限制，不能写成放在哪篇文章都成立的万能评论。只输出 JSON，不要额外解释。",
        userPrompt: buildPrompt(post, roles),
        temperature: attempt === 1 ? 0.35 : 0.2,
      });
      const parsed = parseRoleCommentPayload(text);

      if (!Array.isArray(parsed.comments)) {
        throw new Error("MiniMax response did not include comments array");
      }

      const groundedComments = parsed.comments.filter((item) =>
        isGroundedRoleComment(post, item.content),
      );

      if (!groundedComments.length) {
        throw new Error("MiniMax comments were too generic and failed grounding checks");
      }

      return {
        comments: groundedComments,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MiniMax comment generation failed");
      console.warn("MiniMax comment attempt failed", {
        postId: post.id,
        attempt,
        error: lastError.message,
      });
    }
  }

  throw lastError ?? new Error("MiniMax comment generation failed");
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
      "如果评论没有点出文中的具体对象、动作、数字、限制、场景或结果，就视为不合格。",
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

function parseRoleCommentPayload(value: string): RoleCommentPayload {
  const cleanValue = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleanValue) as RoleCommentPayload;
}

function isGroundedRoleComment(post: Post, content: string) {
  const normalized = content.trim();
  if (normalized.length < 40) return false;

  const genericPatterns = [
    /^这很值得关注/,
    /^我更关心的是/,
    /^值得关注的是/,
    /^这说明/,
    /^可以看出/,
    /值得关注|引发关注|非常重要|未来可期|拭目以待/,
  ];
  if (genericPatterns.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  const groundingTerms = extractGroundingTerms(post);
  return groundingTerms.some((term) => normalized.includes(term));
}

function extractGroundingTerms(post: Post) {
  const candidates = [
    post.sourceName,
    ...post.tags,
    ...post.title.split(/[\s,，。:：/|｜()（）【】\-]/),
    ...post.summary.split(/[\s,，。:：/|｜()（）【】\-]/),
  ]
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .filter((part) => !/^(AI|视频|文章|内容|评论|来源)$/.test(part));

  return Array.from(new Set(candidates)).slice(0, 24);
}
