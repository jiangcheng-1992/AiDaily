import type { Comment, Post, PostType } from "@/lib/mock-data";

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
    writeComment: (post) =>
      `从产品角度看，「${post.title}」最值得拆的是用户刚需和使用频次。它不只是一个 AI 动态，更可能成为垂直场景里的新入口。建议继续观察：谁会为它付费，以及它替代的是现有流程里的哪一步。`,
  },
  {
    id: "indie-hacker",
    name: "独立开发者",
    title: "关注 MVP、低成本验证和副业机会",
    avatarText: "独",
    focus: "小产品、自动化、快速验证",
    preferredTypes: ["tool", "product", "skill", "case"],
    writeComment: (post) =>
      `独立开发者可以先别急着做大而全，围绕「${post.tags[0] ?? "AI"}」切一个很窄的 MVP：信息整理、模板生成、自动化执行或案例库都可以。关键是 48 小时内做出可试用版本，再用真实反馈判断是否继续。`,
  },
  {
    id: "research-reader",
    name: "论文雷达",
    title: "关注技术证据、评测和可复现性",
    avatarText: "研",
    focus: "论文、模型能力、基准评测",
    preferredTypes: ["news", "opinion", "tool"],
    writeComment: (post) =>
      `技术上我会重点看两个问题：这个方向是否有可复现证据，以及能力提升来自模型本身还是工作流设计。「${post.title}」值得关注，但最好结合论文、基准和失败案例一起判断。`,
  },
  {
    id: "growth-operator",
    name: "增长操盘手",
    title: "关注传播、内容增长和获客效率",
    avatarText: "增",
    focus: "增长路径、内容分发、转化效率",
    preferredTypes: ["case", "skill", "product"],
    writeComment: () =>
      `这条内容对增长侧的启发是：AI 不只是提效工具，也能变成内容生产和用户触达的放大器。若要落地，可以先选一个高频内容场景，做出前后效率对比，再用案例数据说服团队或客户。`,
  },
  {
    id: "creator-coach",
    name: "创作者教练",
    title: "关注内容创作、个人品牌和知识产品",
    avatarText: "创",
    focus: "创作者工作流、选题、交付形式",
    preferredTypes: ["skill", "case", "opinion"],
    writeComment: (post) =>
      `创作者可以把这条动态拆成一个选题：新能力是什么、普通人怎么用、能不能形成一套可复制流程。真正有价值的内容不是转述新闻，而是把「${post.tags[0] ?? "AI"}」翻译成读者今天就能试的行动清单。`,
  },
  {
    id: "risk-observer",
    name: "风险观察员",
    title: "关注版权、合规、幻觉和长期影响",
    avatarText: "风",
    focus: "风险边界、合规、可靠性",
    preferredTypes: ["news", "opinion", "product", "case"],
    writeComment: () =>
      "这里也要留意风险边界：数据来源、版权、幻觉、企业合规和用户过度依赖都可能影响落地。越接近真实业务，越需要保留人工审核和可追溯记录。",
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
