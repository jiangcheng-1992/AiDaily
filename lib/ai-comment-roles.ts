import type { Comment, Post, PostType } from "@/lib/mock-data";
import { buildRoleComment } from "@/lib/post-insights";

export type AiCommentRole = {
  id: string;
  name: string;
  title: string;
  avatarText: string;
  focus: string;
  preferredTypes?: PostType[];
  writeComment: (post: Post) => string;
};

export const aiCommentRoles: AiCommentRole[] = [
  {
    id: "product-strategist",
    name: "产品策略官",
    title: "关注商业化、用户需求和产品机会",
    avatarText: "产",
    focus: "产品定位、用户价值、商业模式",
    preferredTypes: ["product", "tool", "case", "news"],
    writeComment: (post) => buildRoleComment(post, "product-strategist"),
  },
  {
    id: "indie-hacker",
    name: "独立开发者",
    title: "关注 MVP、低成本验证和副业机会",
    avatarText: "独",
    focus: "小产品、自动化、快速验证",
    preferredTypes: ["tool", "product", "skill", "case"],
    writeComment: (post) => buildRoleComment(post, "indie-hacker"),
  },
  {
    id: "research-reader",
    name: "论文雷达",
    title: "关注技术证据、评测和可复现性",
    avatarText: "研",
    focus: "论文、模型能力、基准评测",
    preferredTypes: ["news", "opinion", "tool"],
    writeComment: (post) => buildRoleComment(post, "research-reader"),
  },
  {
    id: "growth-operator",
    name: "增长操盘手",
    title: "关注传播、内容增长和获客效率",
    avatarText: "增",
    focus: "增长路径、内容分发、转化效率",
    preferredTypes: ["case", "skill", "product"],
    writeComment: (post) => buildRoleComment(post, "growth-operator"),
  },
  {
    id: "creator-coach",
    name: "创作者教练",
    title: "关注内容创作、个人品牌和知识产品",
    avatarText: "创",
    focus: "创作者工作流、选题、交付形式",
    preferredTypes: ["skill", "case", "opinion"],
    writeComment: (post) => buildRoleComment(post, "creator-coach"),
  },
  {
    id: "risk-observer",
    name: "风险观察员",
    title: "关注版权、合规、幻觉和长期影响",
    avatarText: "风",
    focus: "风险边界、合规、可靠性",
    preferredTypes: ["news", "opinion", "product", "case"],
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
  return selectRolesForPost(post)
    .filter((role) => !existingRoleIds.includes(role.id))
    .map((role, index) =>
      createAiComment({
        post,
        role,
        content: role.writeComment(post),
        index,
      }),
    );
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
  };
}

function stableScore(value: string) {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % 36;
}
