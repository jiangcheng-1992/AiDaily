import type { Comment, Post, PostType } from "@/lib/mock-data";
import { buildRoleComment } from "@/lib/post-insights";

export const AI_COMMENT_GENERATION_VERSION = "2026-05-grounded-v2";

export type AiCommentRole = {
  id: string;
  name: string;
  title: string;
  avatarText: string;
  focus: string;
  preferredTypes?: PostType[];
  writeComment: (post: Post, options?: { variant?: number }) => string;
};

export const aiCommentRoles: AiCommentRole[] = [
  {
    id: "product-strategist",
    name: "产品策略官",
    title: "关注商业化、用户需求和产品机会",
    avatarText: "产",
    focus: "产品定位、用户价值、商业模式",
    preferredTypes: ["product", "tool", "case", "news", "video"],
    writeComment: (post) => buildRoleComment(post, "product-strategist"),
  },
  {
    id: "indie-hacker",
    name: "独立开发者",
    title: "关注 MVP、低成本验证和副业机会",
    avatarText: "独",
    focus: "小产品、自动化、快速验证",
    preferredTypes: ["tool", "product", "skill", "case", "video"],
    writeComment: (post) => buildRoleComment(post, "indie-hacker"),
  },
  {
    id: "research-reader",
    name: "论文雷达",
    title: "关注技术证据、评测和可复现性",
    avatarText: "研",
    focus: "论文、模型能力、基准评测",
    preferredTypes: ["news", "opinion", "tool", "video"],
    writeComment: (post) => buildRoleComment(post, "research-reader"),
  },
  {
    id: "growth-operator",
    name: "增长操盘手",
    title: "关注传播、内容增长和获客效率",
    avatarText: "增",
    focus: "增长路径、内容分发、转化效率",
    preferredTypes: ["case", "skill", "product", "video"],
    writeComment: (post) => buildRoleComment(post, "growth-operator"),
  },
  {
    id: "creator-coach",
    name: "创作者教练",
    title: "关注内容创作、个人品牌和知识产品",
    avatarText: "创",
    focus: "创作者工作流、选题、交付形式",
    preferredTypes: ["skill", "case", "opinion", "video"],
    writeComment: (post) => buildRoleComment(post, "creator-coach"),
  },
  {
    id: "risk-observer",
    name: "风险观察员",
    title: "关注版权、合规、幻觉和长期影响",
    avatarText: "风",
    focus: "风险边界、合规、可靠性",
    preferredTypes: ["news", "opinion", "product", "case", "video"],
    writeComment: (post) => buildRoleComment(post, "risk-observer"),
  },
];

export function selectRolesForPost(post: Post) {
  const exactMatches = aiCommentRoles.filter((role) =>
    role.preferredTypes?.includes(post.type),
  );
  const fallbackRoles = aiCommentRoles.filter(
    (role) => !exactMatches.some((match) => match.id === role.id),
  );

  return [...exactMatches, ...fallbackRoles].slice(0, 4);
}

export function generateAiCommentsForPost(
  post: Post,
  existingRoleIds: string[] = [],
) {
  const nextComments: Comment[] = [];
  const generatedContents: string[] = [];

  selectRolesForPost(post)
    .filter((role) => !existingRoleIds.includes(role.id))
    .forEach((role, index) => {
      const content = buildDistinctRoleComment(post, role, generatedContents);
      generatedContents.push(content);
      nextComments.push(
        createAiComment({
          post,
          role,
          content,
          index,
        }),
      );
    });

  return nextComments;
}

export function createAiComment({
  post,
  role,
  content,
  index,
}: {
  post: Post;
  role: AiCommentRole;
  content: string;
  index: number;
}): Comment {
  return {
    id: `ai-${post.id}-${role.id}`,
    postId: post.id,
    author: role.name,
    content,
    createdAt: new Date(Date.now() + index * 1000).toISOString(),
    likesCount: 12 + stableScore(`${post.id}-${role.id}`),
    avatarText: role.avatarText,
    isAi: true,
    roleId: role.id,
    roleName: role.name,
    generationVersion: AI_COMMENT_GENERATION_VERSION,
  };
}

function stableScore(value: string) {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % 36;
}

function buildDistinctRoleComment(post: Post, role: AiCommentRole, existingContents: string[]) {
  let fallback = role.writeComment(post);

  for (let variant = 0; variant < 4; variant += 1) {
    const candidate = role.writeComment(post, { variant });
    if (!existingContents.some((content) => areCommentsTooSimilar(content, candidate))) {
      return candidate;
    }
    fallback = candidate;
  }

  return fallback;
}

function areCommentsTooSimilar(left: string, right: string) {
  const normalizedLeft = normalizeCommentText(left);
  const normalizedRight = normalizeCommentText(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return true;
  }

  const leftBigrams = toBigrams(normalizedLeft);
  const rightBigrams = toBigrams(normalizedRight);
  const intersection = leftBigrams.filter((token) => rightBigrams.includes(token)).length;
  const union = new Set([...leftBigrams, ...rightBigrams]).size;

  return union > 0 && intersection / union >= 0.72;
}

function normalizeCommentText(value: string) {
  return value.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
}

function toBigrams(value: string) {
  if (value.length < 2) return [value];

  const result: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    result.push(value.slice(index, index + 2));
  }
  return result;
}
