export type WorkType =
  | "image"
  | "video"
  | "website"
  | "app"
  | "prompt"
  | "workflow"
  | "github";

export type WorkSource =
  | "user"
  | "editor"
  | "producthunt"
  | "itchio"
  | "youtube"
  | "huggingface"
  | "github"
  | "hackernews"
  | "manual";

export type WorkStatus = "draft" | "pending" | "approved" | "rejected";
export type WorkCategoryId =
  | "all"
  | "media"
  | "website-agent"
  | "game";

export type WorkItem = {
  id: string;
  title: string;
  description: string;
  whyInteresting: string;
  type: WorkType;
  source: WorkSource;
  coverUrl: string;
  mediaUrls?: string[];
  videoUrl?: string;
  externalUrl?: string;
  apkUrl?: string;
  githubUrl?: string;
  authorName?: string;
  authorAvatar?: string;
  originalAuthorUrl?: string;
  toolNames?: string[];
  tags: string[];
  prompt?: string;
  workflowSteps?: string[];
  techStack?: string[];
  status: WorkStatus;
  featured: boolean;
  sourceVerified: boolean;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  clickCount: number;
  heatScore: number;
  createdAt: string;
  publishedAt?: string;
};

export const workTypeLabels: Record<WorkType, string> = {
  image: "图片",
  video: "视频",
  website: "网站",
  app: "App",
  prompt: "Prompt",
  workflow: "工作流",
  github: "开源项目",
};

export const workSourceLabels: Record<WorkSource, string> = {
  user: "用户投稿",
  editor: "编辑精选",
  producthunt: "Product Hunt",
  itchio: "itch.io",
  youtube: "YouTube",
  huggingface: "Hugging Face",
  github: "GitHub",
  hackernews: "Hacker News",
  manual: "手动收录",
};

export const interestingCategories: Array<{ id: WorkCategoryId; label: string }> = [
  { id: "all", label: "全部" },
  { id: "media", label: "图片/视频" },
  { id: "website-agent", label: "网站/agent" },
  { id: "game", label: "游戏" },
];

export function getWorkCategoryId(work: WorkItem): Exclude<WorkCategoryId, "all"> {
  if (work.source === "itchio") return "game";
  if (work.type === "image" || work.type === "video") return "media";
  return "website-agent";
}

export function workMatchesInterestingCategory(work: WorkItem, category: WorkCategoryId) {
  if (category === "all") return true;
  return getWorkCategoryId(work) === category;
}

export function getWorkTypeLabel(work: WorkItem) {
  if (getWorkCategoryId(work) === "game") return "游戏";
  return workTypeLabels[work.type];
}

export const interestingWorks: WorkItem[] = [
  {
    id: "cyber-city-poster-generator",
    title: "3D AI 城市海报生成器",
    description: "输入一句话，自动生成赛博城市宣传图，适合产品发布、活动预热和短视频封面。",
    whyInteresting: "它把 Prompt、构图和品牌文案组合成一个可复刻流程，普通创作者也能快速做出商业感视觉。",
    type: "image",
    source: "editor",
    coverUrl: imageUrl("cinematic cyberpunk city poster, holographic product billboard, neon rain, realistic 3D render, sharp typography area, high detail", "portrait_4_3"),
    externalUrl: "https://www.midjourney.com/",
    authorName: "Mira Chen",
    toolNames: ["Midjourney", "Photoshop"],
    tags: ["AI图片", "海报", "可复刻"],
    prompt: "cyberpunk city poster, neon billboard, cinematic 3D render, product launch visual, high contrast",
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 4820,
    likeCount: 248,
    favoriteCount: 96,
    commentCount: 12,
    clickCount: 620,
    heatScore: 96,
    createdAt: "2026-05-25T07:00:00.000Z",
    publishedAt: "2026-05-25T07:10:00.000Z",
  },
  {
    id: "sora-robot-short-film",
    title: "机器人早餐店短片",
    description: "用 Sora 做的一分钟剧情短片，机器人店员在清晨给城市打工人准备早餐。",
    whyInteresting: "短片不是单镜头炫技，而是有明确人物、场景和情绪，非常适合观察 AI 视频叙事能力。",
    type: "video",
    source: "youtube",
    coverUrl: imageUrl("warm cinematic still, robot barista making breakfast in a tiny futuristic street cafe, morning light, film grain", "landscape_16_9"),
    videoUrl: "https://www.youtube.com/results?search_query=sora+robot+short+film",
    externalUrl: "https://www.youtube.com/results?search_query=sora+robot+short+film",
    authorName: "AI Film Notes",
    toolNames: ["Sora", "Runway"],
    tags: ["AI视频", "短片", "Sora"],
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 9120,
    likeCount: 386,
    favoriteCount: 142,
    commentCount: 33,
    clickCount: 1090,
    heatScore: 98,
    createdAt: "2026-05-25T06:40:00.000Z",
  },
  {
    id: "one-word-english-video-workflow",
    title: "输入一个单词，生成英语启蒙视频",
    description: "把单词、例句、图像、配音和分镜串成自动化流程，适合亲子英语内容号。",
    whyInteresting: "它展示了 AI 工作流真正有用的地方：把重复内容生产拆成可自动执行的步骤。",
    type: "workflow",
    source: "manual",
    coverUrl: imageUrl("friendly educational AI workflow diagram, word to kids english video, colorful cards, voiceover timeline, clean interface", "landscape_4_3"),
    externalUrl: "https://www.make.com/",
    authorName: "Flow Maker",
    toolNames: ["Make", "GPT-5.5", "ElevenLabs", "Canva"],
    tags: ["工作流", "教育", "短视频"],
    workflowSteps: ["输入英文单词", "生成例句和故事脚本", "生成 4 张分镜图", "合成配音", "导出竖版视频"],
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 3210,
    likeCount: 176,
    favoriteCount: 88,
    commentCount: 9,
    clickCount: 410,
    heatScore: 88,
    createdAt: "2026-05-25T06:20:00.000Z",
  },
  {
    id: "prompt-wukong-game-screenshot",
    title: "一键生成黑神话风格游戏截图",
    description: "用于生成暗黑神话感动作游戏截图，包含镜头、光影、材质和 UI 氛围设定。",
    whyInteresting: "Prompt 结构清晰，可以直接拆成角色、场景、镜头、材质四段复用。",
    type: "prompt",
    source: "user",
    coverUrl: imageUrl("dark myth fantasy game screenshot, monkey warrior silhouette, ancient temple, dramatic volumetric lighting, unreal engine style", "landscape_16_9"),
    externalUrl: "https://chat.openai.com/",
    authorName: "Prompt Deer",
    toolNames: ["Midjourney", "GPT"],
    tags: ["Prompt", "游戏截图", "视觉风格"],
    prompt: "dark myth action game screenshot, ancient chinese temple, dramatic lighting, cinematic third-person camera, detailed armor, UI overlay",
    status: "approved",
    featured: false,
    sourceVerified: false,
    viewCount: 2780,
    likeCount: 132,
    favoriteCount: 74,
    commentCount: 8,
    clickCount: 338,
    heatScore: 82,
    createdAt: "2026-05-25T05:45:00.000Z",
  },
  {
    id: "agent-demo-for-research-notes",
    title: "自动整理论文笔记的 Agent Demo",
    description: "上传论文链接后，自动抽取贡献点、实验设置、局限性和可复现清单。",
    whyInteresting: "它把读论文这件事变成了结构化流程，适合研究员、产品经理和内容创作者。",
    type: "website",
    source: "huggingface",
    coverUrl: imageUrl("AI research notes web app dashboard, paper summary cards, clean SaaS interface, blue violet gradient", "landscape_16_9"),
    externalUrl: "https://huggingface.co/spaces",
    githubUrl: "https://github.com/",
    authorName: "Paper Agent Lab",
    toolNames: ["Hugging Face", "LangChain", "Claude"],
    tags: ["网站", "Agent", "论文"],
    techStack: ["Next.js", "Python", "Vector DB"],
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 5360,
    likeCount: 294,
    favoriteCount: 155,
    commentCount: 21,
    clickCount: 880,
    heatScore: 94,
    createdAt: "2026-05-25T05:20:00.000Z",
  },
  {
    id: "ai-room-makeover-app",
    title: "拍一张房间照，生成 12 套改造方案",
    description: "面向租房党和家居博主的小应用，上传房间图后生成不同风格的软装改造图。",
    whyInteresting: "这是非常直观的 AI 消费级场景，用户一眼能看懂价值，也容易产生分享。",
    type: "app",
    source: "producthunt",
    coverUrl: imageUrl("mobile app mockup for AI room makeover, before after interior design, cozy apartment, realistic screenshots", "portrait_4_3"),
    externalUrl: "https://www.producthunt.com/",
    authorName: "Roomly AI",
    toolNames: ["Stable Diffusion", "React Native"],
    tags: ["App", "AI图片", "家居"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 4210,
    likeCount: 203,
    favoriteCount: 119,
    commentCount: 18,
    clickCount: 760,
    heatScore: 86,
    createdAt: "2026-05-25T04:40:00.000Z",
  },
  {
    id: "open-source-voice-clone-kit",
    title: "开源轻量声音克隆工具包",
    description: "几分钟样本即可生成可用音色，适合本地播客、课程配音和游戏原型。",
    whyInteresting: "它降低了音频创作门槛，同时也提醒创作者必须关注授权和声音滥用风险。",
    type: "github",
    source: "github",
    coverUrl: imageUrl("open source voice cloning toolkit interface, waveform editor, terminal window, futuristic audio lab", "landscape_4_3"),
    externalUrl: "https://github.com/",
    githubUrl: "https://github.com/",
    authorName: "Open Voice Hackers",
    toolNames: ["PyTorch", "ONNX"],
    tags: ["开源", "语音", "本地部署"],
    techStack: ["Python", "PyTorch", "FastAPI"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 6120,
    likeCount: 344,
    favoriteCount: 188,
    commentCount: 27,
    clickCount: 940,
    heatScore: 93,
    createdAt: "2026-05-24T23:10:00.000Z",
  },
  {
    id: "kling-fashion-ad",
    title: "Kling 生成的 15 秒运动鞋广告",
    description: "用三段镜头完成产品特写、跑步场景和品牌结尾，适合小品牌低成本测试广告创意。",
    whyInteresting: "它展示了 AI 视频作为广告分镜验证工具的潜力，不必等完整拍摄就能先测创意。",
    type: "video",
    source: "manual",
    coverUrl: imageUrl("cinematic sneaker commercial still, runner on wet city street, product closeup, AI generated video look", "landscape_16_9"),
    videoUrl: "https://klingai.com/",
    externalUrl: "https://klingai.com/",
    authorName: "Motion Prompt",
    toolNames: ["Kling", "CapCut"],
    tags: ["AI视频", "广告", "Kling"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 3980,
    likeCount: 189,
    favoriteCount: 81,
    commentCount: 14,
    clickCount: 522,
    heatScore: 84,
    createdAt: "2026-05-24T22:20:00.000Z",
  },
  {
    id: "ai-manga-storyboard",
    title: "四格漫画分镜自动生成器",
    description: "输入人物设定和冲突，自动生成四格漫画脚本、画面和对白。",
    whyInteresting: "它把漫画创作中最难的节奏和分镜先搭出来，适合个人 IP 做连续内容。",
    type: "image",
    source: "editor",
    coverUrl: imageUrl("four panel manga storyboard, cute robot character, clean comic layout, expressive scenes, black white and blue accent", "square_hd"),
    externalUrl: "https://www.canva.com/",
    authorName: "Comic Flow",
    toolNames: ["GPT", "Canva", "即梦"],
    tags: ["AI图片", "漫画", "IP"],
    prompt: "four panel manga storyboard, consistent character, expressive composition, clean speech bubbles",
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 2560,
    likeCount: 126,
    favoriteCount: 66,
    commentCount: 6,
    clickCount: 290,
    heatScore: 78,
    createdAt: "2026-05-24T21:00:00.000Z",
  },
  {
    id: "personal-ai-search-site",
    title: "个人知识库 AI 搜索站",
    description: "把收藏文章、PDF 和笔记接入统一搜索，回答时带原文引用。",
    whyInteresting: "这是个人效率工具里最容易产生长期价值的一类 AI 应用，越用越像个人记忆。",
    type: "website",
    source: "hackernews",
    coverUrl: imageUrl("personal AI search website, knowledge graph, document cards, citation panel, minimal interface", "landscape_16_9"),
    externalUrl: "https://news.ycombinator.com/",
    githubUrl: "https://github.com/",
    authorName: "Indie Builder",
    toolNames: ["RAG", "OpenAI", "Supabase"],
    tags: ["网站", "知识库", "RAG"],
    techStack: ["Next.js", "Supabase", "pgvector"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 5830,
    likeCount: 271,
    favoriteCount: 174,
    commentCount: 31,
    clickCount: 860,
    heatScore: 90,
    createdAt: "2026-05-24T20:30:00.000Z",
  },
  {
    id: "product-name-to-launch-kit",
    title: "输入产品名，生成宣传图 + 视频脚本 + 标题",
    description: "适合独立开发者做 Product Hunt 首发前的物料准备。",
    whyInteresting: "它把 launch 前最耗时间的素材准备做成半自动流程，能明显缩短上线周期。",
    type: "workflow",
    source: "manual",
    coverUrl: imageUrl("AI product launch workflow board, product name to poster video script headline, startup workspace", "landscape_4_3"),
    externalUrl: "https://zapier.com/",
    authorName: "Launch Ops",
    toolNames: ["Zapier", "GPT", "Runway", "Figma"],
    tags: ["工作流", "产品发布", "独立开发"],
    workflowSteps: ["输入产品名和目标用户", "生成卖点和标题", "生成宣传图", "生成 15 秒视频脚本", "输出发布清单"],
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 4760,
    likeCount: 236,
    favoriteCount: 151,
    commentCount: 19,
    clickCount: 700,
    heatScore: 91,
    createdAt: "2026-05-24T19:15:00.000Z",
  },
  {
    id: "tiny-ai-game-lab",
    title: "一句话生成可玩的网页小游戏",
    description: "输入玩法描述后生成 HTML 小游戏，可导出代码继续改。",
    whyInteresting: "它让非程序员也能先验证玩法，AI 原型工具开始进入游戏创作。",
    type: "website",
    source: "producthunt",
    coverUrl: imageUrl("browser based mini game generator, pixel art game preview, code panel, playful UI", "landscape_16_9"),
    externalUrl: "https://www.producthunt.com/",
    githubUrl: "https://github.com/",
    authorName: "Tiny Game Lab",
    toolNames: ["Claude", "Vercel", "Canvas"],
    tags: ["小游戏", "网站", "代码生成"],
    techStack: ["HTML", "Canvas", "TypeScript"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 3320,
    likeCount: 166,
    favoriteCount: 101,
    commentCount: 13,
    clickCount: 520,
    heatScore: 83,
    createdAt: "2026-05-24T18:00:00.000Z",
  },
  {
    id: "veo-travel-memory",
    title: "把旅行照片变成电影感回忆短片",
    description: "用多张照片生成连贯镜头，再配自动旁白和音乐。",
    whyInteresting: "AI 视频不只适合专业广告，也能把普通人的生活素材变成可分享作品。",
    type: "video",
    source: "youtube",
    coverUrl: imageUrl("cinematic travel memory video still, family photos turning into moving film, sunset seaside, warm nostalgic tone", "landscape_16_9"),
    videoUrl: "https://www.youtube.com/results?search_query=veo+travel+memory+video",
    externalUrl: "https://www.youtube.com/results?search_query=veo+travel+memory+video",
    authorName: "Veo Stories",
    toolNames: ["Veo", "ElevenLabs"],
    tags: ["AI视频", "旅行", "Veo"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 7020,
    likeCount: 315,
    favoriteCount: 128,
    commentCount: 25,
    clickCount: 910,
    heatScore: 89,
    createdAt: "2026-05-24T17:20:00.000Z",
  },
  {
    id: "huggingface-character-chat",
    title: "可自定义人设的角色聊天 Space",
    description: "上传设定卡后生成角色聊天界面，支持语气、记忆和头像切换。",
    whyInteresting: "它把角色 IP、聊天体验和轻量部署结合起来，适合测试虚拟陪伴和剧情互动。",
    type: "app",
    source: "huggingface",
    coverUrl: imageUrl("character chat AI app interface, avatar cards, personality settings, cozy gradient UI", "landscape_4_3"),
    externalUrl: "https://huggingface.co/spaces",
    authorName: "Character Space",
    toolNames: ["Gradio", "Llama", "Hugging Face"],
    tags: ["App", "角色聊天", "Hugging Face"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 3890,
    likeCount: 181,
    favoriteCount: 107,
    commentCount: 16,
    clickCount: 650,
    heatScore: 82,
    createdAt: "2026-05-24T16:10:00.000Z",
  },
  {
    id: "prompt-brand-mascot",
    title: "生成一套品牌吉祥物视觉",
    description: "从品牌关键词生成吉祥物、表情包、海报和贴纸风格。",
    whyInteresting: "它适合小团队快速建立视觉记忆点，不必一开始就投入完整品牌设计预算。",
    type: "prompt",
    source: "editor",
    coverUrl: imageUrl("brand mascot design sheet, cute AI robot character, stickers expressions poster mockup, clean white background", "square_hd"),
    externalUrl: "https://www.ideogram.ai/",
    authorName: "Brand Prompt",
    toolNames: ["Ideogram", "Midjourney"],
    tags: ["Prompt", "品牌", "吉祥物"],
    prompt: "cute brand mascot character sheet, expressive stickers, product poster mockup, clean vector 3D hybrid style",
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 2410,
    likeCount: 118,
    favoriteCount: 69,
    commentCount: 7,
    clickCount: 340,
    heatScore: 76,
    createdAt: "2026-05-24T15:00:00.000Z",
  },
  {
    id: "github-ui-agent-starter",
    title: "UI Agent Starter：让 AI 操作浏览器做 QA",
    description: "开源项目，给 Agent 浏览网页、点击按钮、截图回传和写测试报告的基础能力。",
    whyInteresting: "它把 AI Agent 从聊天窗口带到真实网页环境，适合做自动化测试和运营巡检。",
    type: "github",
    source: "github",
    coverUrl: imageUrl("browser automation AI agent open source project, dashboard with screenshots, terminal logs, QA report", "landscape_16_9"),
    externalUrl: "https://github.com/",
    githubUrl: "https://github.com/",
    authorName: "Agent QA",
    toolNames: ["Playwright", "GPT", "TypeScript"],
    tags: ["开源", "Agent", "自动化测试"],
    techStack: ["TypeScript", "Playwright", "Next.js"],
    status: "approved",
    featured: true,
    sourceVerified: true,
    viewCount: 6440,
    likeCount: 356,
    favoriteCount: 210,
    commentCount: 29,
    clickCount: 1040,
    heatScore: 95,
    createdAt: "2026-05-24T14:10:00.000Z",
  },
  {
    id: "news-to-storyboard",
    title: "输入新闻链接，自动生成短视频分镜",
    description: "抓取新闻要点后生成 6 格短视频分镜、旁白和标题候选。",
    whyInteresting: "它把新闻改编短视频的第一步流程化，适合资讯号提升产能。",
    type: "workflow",
    source: "user",
    coverUrl: imageUrl("news article to short video storyboard workflow, six scene panels, narration script, creator desk", "landscape_4_3"),
    externalUrl: "https://n8n.io/",
    authorName: "News Flow",
    toolNames: ["n8n", "GPT", "Runway"],
    tags: ["工作流", "资讯号", "分镜"],
    workflowSteps: ["输入新闻链接", "抽取事实和冲突", "生成 6 格分镜", "生成旁白", "输出标题和封面建议"],
    status: "approved",
    featured: false,
    sourceVerified: false,
    viewCount: 2970,
    likeCount: 151,
    favoriteCount: 82,
    commentCount: 11,
    clickCount: 430,
    heatScore: 80,
    createdAt: "2026-05-24T13:40:00.000Z",
  },
  {
    id: "ai-product-shot-studio",
    title: "AI 产品摄影棚",
    description: "上传商品白底图，自动生成生活方式场景、节日海报和电商主图。",
    whyInteresting: "电商素材是 AI 图片最容易商业化的场景之一，效果好坏可以直接用点击率验证。",
    type: "image",
    source: "producthunt",
    coverUrl: imageUrl("AI product photography studio, skincare bottle on marble table, generated lifestyle ad images, ecommerce mockups", "landscape_4_3"),
    externalUrl: "https://www.producthunt.com/",
    authorName: "Shot Studio",
    toolNames: ["Flux", "Photoshop"],
    tags: ["AI图片", "电商", "产品图"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 5100,
    likeCount: 247,
    favoriteCount: 139,
    commentCount: 17,
    clickCount: 820,
    heatScore: 87,
    createdAt: "2026-05-24T12:20:00.000Z",
  },
  {
    id: "local-llm-desktop-companion",
    title: "本地 LLM 桌面陪跑助手",
    description: "常驻桌面的轻量助手，能读剪贴板、总结网页、生成待办和调用本地模型。",
    whyInteresting: "它把本地模型做成日常入口，而不是停留在命令行玩具。",
    type: "app",
    source: "github",
    coverUrl: imageUrl("desktop AI companion app, local LLM assistant floating window, clipboard summary, dark elegant UI", "landscape_16_9"),
    externalUrl: "https://github.com/",
    githubUrl: "https://github.com/",
    authorName: "Local AI Tools",
    toolNames: ["Ollama", "Electron"],
    tags: ["App", "本地模型", "桌面助手"],
    techStack: ["Electron", "Ollama", "SQLite"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 4670,
    likeCount: 226,
    favoriteCount: 166,
    commentCount: 20,
    clickCount: 740,
    heatScore: 86,
    createdAt: "2026-05-24T11:30:00.000Z",
  },
  {
    id: "ai-landing-page-roaster",
    title: "AI Landing Page Roaster",
    description: "输入网站链接，AI 用毒舌但有用的方式指出首屏、定价和转化问题。",
    whyInteresting: "它把常见增长顾问建议包装成好玩的互动体验，容易传播也有实际价值。",
    type: "website",
    source: "hackernews",
    coverUrl: imageUrl("AI landing page roaster website, humorous critique cards, conversion checklist, startup landing page", "landscape_16_9"),
    externalUrl: "https://news.ycombinator.com/",
    authorName: "Growth Roast",
    toolNames: ["GPT", "Screenshot API"],
    tags: ["网站", "增长", "好玩"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 6980,
    likeCount: 332,
    favoriteCount: 148,
    commentCount: 42,
    clickCount: 1180,
    heatScore: 92,
    createdAt: "2026-05-24T10:00:00.000Z",
  },
  {
    id: "prompt-miniature-world",
    title: "微缩世界产品海报 Prompt",
    description: "把普通产品变成微缩城市、玩具世界或电影布景里的主角。",
    whyInteresting: "这个视觉套路非常适合社媒传播，小品牌也能做出高记忆点的产品图。",
    type: "prompt",
    source: "manual",
    coverUrl: imageUrl("miniature world product poster, tiny people around a giant coffee cup, playful advertising photography, macro lens", "square_hd"),
    externalUrl: "https://www.midjourney.com/",
    authorName: "Mini Prompt",
    toolNames: ["Midjourney", "即梦"],
    tags: ["Prompt", "产品图", "社媒"],
    prompt: "miniature world advertising photography, tiny people interacting with giant product, macro lens, playful cinematic lighting",
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 3020,
    likeCount: 158,
    favoriteCount: 97,
    commentCount: 10,
    clickCount: 390,
    heatScore: 79,
    createdAt: "2026-05-24T09:20:00.000Z",
  },
  {
    id: "ai-music-video-dance",
    title: "AI 生成舞蹈 MV 分镜",
    description: "用即梦和 Pika 拼出一支 30 秒舞蹈 MV，镜头切换和服装风格保持统一。",
    whyInteresting: "它说明 AI 视频已经能承担 MV 预演和低成本视觉实验。",
    type: "video",
    source: "manual",
    coverUrl: imageUrl("AI generated dance music video still, colorful stage lights, synchronized dancers, cinematic fashion", "landscape_16_9"),
    videoUrl: "https://pika.art/",
    externalUrl: "https://pika.art/",
    authorName: "Dance Render",
    toolNames: ["Pika", "即梦", "CapCut"],
    tags: ["AI视频", "MV", "舞蹈"],
    status: "approved",
    featured: false,
    sourceVerified: true,
    viewCount: 5590,
    likeCount: 278,
    favoriteCount: 122,
    commentCount: 24,
    clickCount: 820,
    heatScore: 88,
    createdAt: "2026-05-24T08:40:00.000Z",
  },
];

export function getInterestingWorkById(id: string) {
  return interestingWorks.find((work) => work.id === id);
}

export function getRelatedInterestingWorks(
  work: WorkItem,
  limit = 3,
  works: WorkItem[] = interestingWorks,
) {
  const tagSet = new Set(work.tags);
  return works
    .filter((item) => item.id !== work.id)
    .map((item) => ({
      item,
      score:
        (item.type === work.type ? 3 : 0) +
        item.tags.filter((tag) => tagSet.has(tag)).length * 2 +
        item.heatScore / 100,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

function imageUrl(prompt: string, imageSize: string) {
  return `https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    prompt,
  )}&image_size=${imageSize}`;
}
