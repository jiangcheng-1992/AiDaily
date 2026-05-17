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
  pushed_at: string;
  updated_at: string;
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

const skillQueries = [
  "topic:llm stars:>500 fork:false",
  "topic:ai-agent stars:>300 fork:false",
  "topic:rag stars:>300 fork:false",
  "topic:prompt-engineering stars:>300 fork:false",
  "topic:mcp stars:>100 fork:false",
  "topic:generative-ai stars:>500 fork:false",
];

export async function fetchHotGithubSkillRepos(limit = 8) {
  if (limit <= 0) return [];

  const results = await Promise.allSettled(
    skillQueries.map((query) => searchRepositories(query, Math.ceil(limit / 2))),
  );
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length === results.length) {
    throw new Error("All GitHub skill searches failed");
  }

  const repos = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);
  const seen = new Set<number>();

  return repos
    .filter((repo) => {
      if (seen.has(repo.id)) return false;
      seen.add(repo.id);
      return true;
    })
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

async function searchRepositories(query: string, perPage: number) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "stars");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(perPage));

  const data = await githubFetch<GitHubSearchResponse>(url.toString());
  return data.items ?? [];
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
