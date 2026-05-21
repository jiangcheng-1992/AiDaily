import type { Comment } from "@/lib/mock-data";

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  language: string | null;
  topics?: string[];
  created_at: string;
  pushed_at: string;
  updated_at: string;
  selectionLabel?: string;
  selectionReason?: string;
  owner: {
    login: string;
  };
};

type GitHubSearchResponse = {
  items?: GitHubRepo[];
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  comments: number;
  created_at: string;
  user?: {
    login?: string;
  };
  pull_request?: unknown;
};

type SkillQueryConfig = {
  label: "爆款热门" | "增速快";
  query: string;
  sort: "stars" | "updated";
};

export async function fetchHotGithubSkillRepos(limit = 8) {
  if (limit <= 0) return [];

  const skillQueries = buildSkillQueries();
  const results = await Promise.allSettled(
    skillQueries.map((config) =>
      searchRepositories(config.query, Math.max(3, Math.ceil(limit / 2)), config.sort).then(
        (repos) => ({ config, repos }),
      ),
    ),
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length === results.length) {
    throw new Error("All GitHub skill searches failed");
  }

  const merged = new Map<
    number,
    {
      repo: GitHubRepo;
      labels: Set<SkillQueryConfig["label"]>;
      score: number;
    }
  >();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;

    const { config, repos } = result.value;
    for (const repo of repos) {
      const score = computeRepoTrendScore(repo, config.label);
      const existing = merged.get(repo.id);

      if (!existing) {
        merged.set(repo.id, {
          repo,
          labels: new Set([config.label]),
          score,
        });
        continue;
      }

      existing.labels.add(config.label);
      if (score > existing.score) {
        existing.repo = repo;
        existing.score = score;
      }
    }
  }

  return Array.from(merged.values())
    .map(({ repo, labels, score }) => ({
      ...repo,
      selectionLabel: formatSelectionLabel(labels),
      selectionReason: buildSelectionReason(repo, labels),
      _trendScore: score,
    }))
    .sort(
      (a, b) =>
        b._trendScore - a._trendScore ||
        b.stargazers_count - a.stargazers_count ||
        new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
    )
    .slice(0, limit);
}

export async function fetchGithubRepoIssueComments(
  repo: GitHubRepo,
  limit = 2,
): Promise<Comment[]> {
  const issues = await githubFetch<GitHubIssue[]>(
    `https://api.github.com/repos/${repo.full_name}/issues?state=open&sort=comments&direction=desc&per_page=${limit * 2}`,
  );

  return issues
    .filter((issue) => !issue.pull_request)
    .slice(0, limit)
    .map((issue) => ({
      id: `github-issue-${repo.id}-${issue.number}`,
      postId: `github-${repo.id}`,
      author: issue.user?.login || "GitHub 用户",
      content: `GitHub 真实讨论：${issue.title}（${issue.comments} 条回复）`,
      createdAt: issue.created_at,
      likesCount: issue.comments,
      avatarText: (issue.user?.login || "G").slice(0, 1).toUpperCase(),
    }));
}

async function searchRepositories(query: string, perPage: number, sort: "stars" | "updated") {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", sort);
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));

  const data = await githubFetch<GitHubSearchResponse>(url.toString());
  return data.items ?? [];
}

function buildSkillQueries(): SkillQueryConfig[] {
  const recentPushDate = formatGithubDate(180);
  const risingCreateDate = formatGithubDate(90);
  const risingPushDate = formatGithubDate(21);

  return [
    {
      label: "爆款热门",
      query: `topic:llm stars:>500 pushed:>=${recentPushDate} fork:false`,
      sort: "stars",
    },
    {
      label: "爆款热门",
      query: `topic:ai-agent stars:>250 pushed:>=${recentPushDate} fork:false`,
      sort: "stars",
    },
    {
      label: "爆款热门",
      query: `topic:rag stars:>250 pushed:>=${recentPushDate} fork:false`,
      sort: "stars",
    },
    {
      label: "爆款热门",
      query: `topic:generative-ai stars:>500 pushed:>=${recentPushDate} fork:false`,
      sort: "stars",
    },
    {
      label: "增速快",
      query:
        `topic:llm stars:>80 created:>=${risingCreateDate} pushed:>=${risingPushDate} fork:false`,
      sort: "updated",
    },
    {
      label: "增速快",
      query:
        `topic:ai-agent stars:>60 created:>=${risingCreateDate} pushed:>=${risingPushDate} fork:false`,
      sort: "updated",
    },
    {
      label: "增速快",
      query:
        `topic:mcp stars:>40 created:>=${risingCreateDate} pushed:>=${risingPushDate} fork:false`,
      sort: "updated",
    },
    {
      label: "增速快",
      query:
        `topic:prompt-engineering stars:>60 created:>=${risingCreateDate} pushed:>=${risingPushDate} fork:false`,
      sort: "updated",
    },
  ];
}

function computeRepoTrendScore(repo: GitHubRepo, label: SkillQueryConfig["label"]) {
  const starsScore = Math.log10(repo.stargazers_count + 1) * 120;
  const forksScore = Math.log10(repo.forks_count + 1) * 48;
  const issueScore = Math.log10(repo.open_issues_count + 1) * 22;
  const daysSincePush = diffDays(repo.pushed_at);
  const daysSinceCreate = diffDays(repo.created_at || repo.updated_at);
  const pushBonus = Math.max(0, 21 - daysSincePush) * 3;

  if (label === "增速快") {
    const newRepoBonus = Math.max(0, 60 - daysSinceCreate) * 4;
    return starsScore * 0.7 + forksScore * 0.7 + issueScore + pushBonus + newRepoBonus;
  }

  const matureBonus = daysSincePush <= 7 ? 24 : Math.max(0, 30 - daysSincePush);
  return starsScore + forksScore + issueScore + pushBonus + matureBonus;
}

function formatSelectionLabel(labels: Set<SkillQueryConfig["label"]>) {
  if (labels.has("爆款热门") && labels.has("增速快")) {
    return "爆款热门 + 增速快";
  }

  if (labels.has("增速快")) return "增速快";
  return "爆款热门";
}

function buildSelectionReason(repo: GitHubRepo, labels: Set<SkillQueryConfig["label"]>) {
  const stars = repo.stargazers_count.toLocaleString("zh-CN");
  const forks = repo.forks_count.toLocaleString("zh-CN");
  const pushDays = diffDays(repo.pushed_at);
  const createdDays = diffDays(repo.created_at || repo.updated_at);

  if (labels.has("爆款热门") && labels.has("增速快")) {
    return `既有 ${stars} stars / ${forks} forks 的开发者验证，又在近 ${Math.max(
      1,
      pushDays,
    )} 天保持活跃更新，属于值得持续跟踪的强势仓库。`;
  }

  if (labels.has("增速快")) {
    return `仓库创建约 ${Math.max(
      1,
      createdDays,
    )} 天，近 ${Math.max(1, pushDays)} 天仍在快速迭代，适合优先跟踪新一波工具和工作流方向。`;
  }

  return `已积累 ${stars} stars / ${forks} forks，且最近 ${Math.max(
    1,
    pushDays,
  )} 天仍有更新，属于已被开发者验证的高热度 AI Skill。`;
}

function diffDays(value?: string) {
  if (!value) return 999;
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return 999;
  return Math.max(1, Math.round((Date.now() - ms) / (1000 * 60 * 60 * 24)));
}

function formatGithubDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function githubFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": process.env.AIQ_USER_AGENT || "AIQ/1.0",
    "x-github-api-version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, {
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub returned HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
