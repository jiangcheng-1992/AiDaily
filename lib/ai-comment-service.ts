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
          "你是「AI圈」社区的 AI 评论生成器。请用中文生成像真实社区用户写出的短评论，必须紧扣文章内容本身做拆解，具体、克制、有信息量。不要营销腔，不要编造外部事实，不要空话套话。",
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
      "必须引用文章中的具体动作、限制、数字或业务变化来分析，不要泛泛总结。",
      "不要重复标题，不要只说‘值得关注’‘很重要’这类空泛判断。",
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
    roles: roles.map((role) => ({
      roleId: role.id,
      name: role.name,
      title: role.title,
      focus: role.focus,
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
