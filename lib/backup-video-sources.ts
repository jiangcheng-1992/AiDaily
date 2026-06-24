export type BackupVideoSourcePlatform = "youtube" | "bilibili";

export type BackupVideoSource = {
  id: string;
  name: string;
  platform: BackupVideoSourcePlatform;
  feedUrl: string;
  profileUrl: string;
  bilibiliMid?: string;
  bilibiliKeyword?: string;
  tags: string[];
  includeKeywords?: string[];
  maxItemAgeDays?: number;
  autoIngest: boolean;
};

const youtubeSources: BackupVideoSource[] = [
  {
    id: "youtube-openai",
    name: "YouTube · OpenAI",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A",
    profileUrl: "https://www.youtube.com/@OpenAI",
    tags: ["YouTube", "OpenAI", "AI视频", "模型发布"],
    includeKeywords: ["ai", "openai", "gpt", "chatgpt", "sora", "model", "agent"],
    maxItemAgeDays: 45,
    autoIngest: true,
  },
  {
    id: "youtube-ai-director-dave-clark",
    name: "YouTube · AI Director Dave Clark",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCqrWkLKwRKNZRbbJXVEvAjw",
    profileUrl: "https://www.youtube.com/@AIDirectorDaveClark",
    tags: ["YouTube", "AI短剧", "AI短片", "海外创作者"],
    includeKeywords: [
      "ai",
      "ai film",
      "ai short film",
      "ai drama",
      "short drama",
      "filmmaking",
      "cinematic",
      "sora",
      "runway",
    ],
    maxItemAgeDays: 120,
    autoIngest: true,
  },
  {
    id: "youtube-google-deepmind",
    name: "YouTube · Google DeepMind",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A",
    profileUrl: "https://www.youtube.com/@Google_DeepMind",
    tags: ["YouTube", "DeepMind", "AI视频", "研究"],
    includeKeywords: ["ai", "deepmind", "gemini", "robot", "model", "reasoning", "science"],
    maxItemAgeDays: 60,
    autoIngest: true,
  },
  {
    id: "youtube-two-minute-papers",
    name: "YouTube · Two Minute Papers",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg",
    profileUrl: "https://www.youtube.com/@TwoMinutePapers",
    tags: ["YouTube", "Two Minute Papers", "AI视频", "论文解读"],
    includeKeywords: ["ai", "paper", "papers", "neural", "diffusion", "robot", "model"],
    maxItemAgeDays: 90,
    autoIngest: true,
  },
  {
    id: "youtube-3blue1brown",
    name: "YouTube · 3Blue1Brown",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw",
    profileUrl: "https://www.youtube.com/@3blue1brown",
    tags: ["YouTube", "3Blue1Brown", "AI视频", "数学基础"],
    includeKeywords: ["ai", "neural", "machine learning", "model", "transformer", "llm"],
    maxItemAgeDays: 120,
    autoIngest: true,
  },
  {
    id: "youtube-deeplearning-ai",
    name: "YouTube · DeepLearning.AI",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcIXc5mJsHVYTZR1maL5l9w",
    profileUrl: "https://www.youtube.com/@Deeplearningai",
    tags: ["YouTube", "DeepLearning.AI", "AI视频", "课程"],
    includeKeywords: ["ai", "agent", "llm", "machine learning", "deep learning", "rag"],
    maxItemAgeDays: 60,
    autoIngest: true,
  },
  {
    id: "youtube-lex-fridman",
    name: "YouTube · Lex Fridman AI",
    platform: "youtube",
    feedUrl: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSHZKyawb77ixDdsGog4iWA",
    profileUrl: "https://www.youtube.com/@lexfridman",
    tags: ["YouTube", "Lex Fridman", "AI视频", "访谈"],
    includeKeywords: ["ai", "artificial intelligence", "openai", "deepmind", "robot", "llm"],
    maxItemAgeDays: 90,
    autoIngest: true,
  },
];

const bilibiliSources: BackupVideoSource[] = [
  {
    id: "bilibili-ai-search",
    name: "B站 · AI 大模型热视频",
    platform: "bilibili",
    feedUrl: "bilibili-search://AI 大模型",
    profileUrl: "https://search.bilibili.com/all?keyword=AI%20%E5%A4%A7%E6%A8%A1%E5%9E%8B",
    bilibiliKeyword: "AI 大模型",
    tags: ["B站", "AI视频", "大模型", "中文热点"],
    includeKeywords: ["ai", "人工智能", "大模型", "openai", "deepseek", "模型", "智能体"],
    maxItemAgeDays: 14,
    autoIngest: true,
  },
  {
    id: "bilibili-agent-search",
    name: "B站 · AI Agent 热视频",
    platform: "bilibili",
    feedUrl: "bilibili-search://AI Agent",
    profileUrl: "https://search.bilibili.com/all?keyword=AI%20Agent",
    bilibiliKeyword: "AI Agent",
    tags: ["B站", "AI视频", "Agent", "工具实操"],
    includeKeywords: ["ai", "agent", "智能体", "大模型", "工作流", "自动化"],
    maxItemAgeDays: 21,
    autoIngest: true,
  },
  {
    id: "bilibili-andrew-ng-agent",
    name: "B站 · 吴恩达 AI Agent",
    platform: "bilibili",
    feedUrl: "bilibili-search://吴恩达 AI Agent",
    profileUrl:
      "https://search.bilibili.com/all?keyword=%E5%90%B4%E6%81%A9%E8%BE%BE%20AI%20Agent",
    bilibiliKeyword: "吴恩达 AI Agent",
    tags: ["B站", "吴恩达", "AI视频", "Agent", "课程"],
    includeKeywords: [
      "吴恩达",
      "andrew",
      "ng",
      "ai",
      "agent",
      "智能体",
      "大模型",
      "课程",
    ],
    maxItemAgeDays: 30,
    autoIngest: true,
  },
  {
    id: "bilibili-qbitai",
    name: "B站 · 量子位",
    platform: "bilibili",
    feedUrl: buildRssHubUrl("bilibili/user/video/202515619"),
    profileUrl: "https://space.bilibili.com/202515619",
    bilibiliMid: "202515619",
    tags: ["B站", "量子位", "AI视频", "中文热点"],
    includeKeywords: ["ai", "人工智能", "大模型", "机器人", "openai", "deepseek"],
    maxItemAgeDays: 30,
    autoIngest: true,
  },
  {
    id: "bilibili-jiqizhixin",
    name: "B站 · 机器之心",
    platform: "bilibili",
    feedUrl: buildRssHubUrl("bilibili/user/video/1627047"),
    profileUrl: "https://space.bilibili.com/1627047",
    bilibiliMid: "1627047",
    tags: ["B站", "机器之心", "AI视频", "论文解读"],
    includeKeywords: ["ai", "人工智能", "大模型", "论文", "机器人", "模型"],
    maxItemAgeDays: 30,
    autoIngest: true,
  },
];

export const backupVideoSources = [...bilibiliSources, ...youtubeSources];
export const autoIngestBackupVideoSources = backupVideoSources.filter(
  (source) => source.autoIngest,
);

function buildRssHubUrl(route: string) {
  const baseUrl = process.env.RSSHUB_BASE_URL?.replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/${route.replace(/^\/+/, "")}` : `rsshub://${route}`;
}
