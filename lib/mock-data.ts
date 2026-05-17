export type PostType = "news" | "opinion" | "tool" | "skill" | "product" | "case";

export type Post = {
  id: string;
  type: PostType;
  title: string;
  summary: string;
  content: string;
  whyItMatters: string;
  editorComment: string;
  sourceName: string;
  sourceUrl?: string;
  author?: string;
  tags: string[];
  createdAt: string;
  collectedAt?: string;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  featured?: boolean;
};

export type Comment = {
  id: string;
  postId: string;
  author: string;
  content: string;
  createdAt: string;
  likesCount: number;
  avatarText?: string;
  isAi?: boolean;
  roleId?: string;
  roleName?: string;
};

export type CategoryKey =
  | "recommend"
  | "news"
  | "opinion"
  | "tool"
  | "skill"
  | "product"
  | "case"
  | "ranking";

export const categoryTabs: Array<{ key: CategoryKey; label: string }> = [
  { key: "recommend", label: "推荐" },
  { key: "news", label: "新闻" },
  { key: "opinion", label: "观点" },
  { key: "tool", label: "工具" },
  { key: "skill", label: "技巧" },
  { key: "product", label: "产品" },
  { key: "case", label: "案例" },
  { key: "ranking", label: "榜单" },
];

export const postTypeMeta: Record<
  PostType,
  { label: string; tone: "blue" | "violet" | "emerald" | "amber" | "rose" | "cyan" }
> = {
  news: { label: "新闻", tone: "blue" },
  opinion: { label: "观点", tone: "violet" },
  tool: { label: "工具", tone: "cyan" },
  skill: { label: "技巧", tone: "emerald" },
  product: { label: "产品", tone: "amber" },
  case: { label: "案例", tone: "rose" },
};

export const mockPosts: Post[] = [
  {
    id: "sora-4k-timeline",
    type: "news",
    title: "OpenAI 推出 Sora 春季更新：支持 4K 视频生成与时间轴控制",
    summary:
      "新版 Sora 加入更稳定的长视频控制、角色一致性和镜头级编辑能力，创作者可以像剪辑软件一样调整生成片段。",
    content:
      "OpenAI 在春季发布会上公布了 Sora 的新版本。相比早期演示，新版本强调可控性而不是单次生成的惊艳程度，支持 4K 输出、镜头级时间轴编辑，以及跨片段的角色一致性。\n\n对创作者来说，这意味着视频生成正在从“玩具式试验”进入“可规划的制作流程”。用户可以先生成分镜，再逐段调整角色动作、镜头运动和背景细节，最后导出更适合商业使用的视频素材。\n\n目前这类能力仍需要较高的提示词组织和审美判断，但它已经明显降低了短视频广告、课程预告、产品动效和概念片的制作门槛。",
    whyItMatters:
      "AI 视频的竞争重点正在从“能不能生成”转向“能不能被专业流程稳定使用”。这会直接影响设计、营销、短剧和教育内容行业。",
    editorComment:
      "这类更新最值得关注的不是 4K 本身，而是时间轴和一致性。一旦视频生成可以被迭代、复用和团队协作，它就真正进入生产系统了。",
    sourceName: "Tech Crunch",
    sourceUrl: "https://techcrunch.com",
    author: "Mira Chen",
    tags: ["Sora", "AI视频", "OpenAI", "创作者"],
    createdAt: "2026-05-16T08:40:00+08:00",
    likesCount: 342,
    commentsCount: 89,
    savesCount: 126,
    featured: true,
  },
  {
    id: "agentic-workflows-ng",
    type: "opinion",
    title: "Andrew Ng：Agentic Workflows 会成为今年 AI 应用的核心分水岭",
    summary:
      "Andrew Ng 在最新通讯中表示，AI 应用的下一波效率提升来自任务拆解、反思、工具调用和多智能体协作。",
    content:
      "Andrew Ng 将 Agentic Workflows 拆解为几个关键模式：规划、反思、工具调用、多代理协作，以及带有记忆的循环执行。他认为这些模式会让模型从“一次性回答”升级为“持续完成任务”。\n\n在实际产品中，这意味着 AI 不再只负责生成一段文本，而是可以持续检查结果、调用外部系统、根据反馈调整路径，并把复杂任务拆成多个可验证步骤。\n\n对独立开发者来说，这也是今年最容易产生新产品机会的方向之一。很多看似成熟的垂直工具，都可以通过 agent 化重做一遍。",
    whyItMatters:
      "当模型能力趋近时，真正的产品差异会来自工作流设计。谁能把 AI 嵌入真实任务链路，谁就更可能拿到用户付费。",
    editorComment:
      "Agent 不是一个按钮，而是一套任务组织方式。与其纠结“智能体”这个词，不如先把用户每天重复的 5 步流程拆出来。",
    sourceName: "The Batch",
    sourceUrl: "https://www.deeplearning.ai/the-batch/",
    author: "Andrew Ng",
    tags: ["Agent", "工作流", "产品机会", "自动化"],
    createdAt: "2026-05-16T07:25:00+08:00",
    likesCount: 1280,
    commentsCount: 156,
    savesCount: 382,
    featured: true,
  },
  {
    id: "cursor-memory-rules",
    type: "skill",
    title: "Cursor 项目规则写法升级：用三层规则减少 AI 改错代码",
    summary:
      "把规则拆成项目约束、业务语义和代码风格三层，可以显著减少 AI 助手误改架构和破坏已有模式的概率。",
    content:
      "很多人使用 AI 编程工具时，会把所有要求塞进同一个规则文件，结果 AI 很难区分哪些是必须遵守的架构约束，哪些只是偏好的写法。\n\n更稳妥的方式是分成三层：第一层写项目不可破坏的边界，例如路由约定、数据访问方式、权限判断位置；第二层写业务语义，例如订单状态、积分规则、内容审核逻辑；第三层才写命名、组件拆分、样式偏好等实现风格。\n\n当规则越接近系统事实，AI 的帮助越像靠谱同事；当规则只是口号，AI 就会靠猜。",
    whyItMatters:
      "AI 编程效率的上限不只由模型决定，也由上下文组织能力决定。规则写得好，返工会少很多。",
    editorComment:
      "建议把项目规则当成“给新同事看的开发手册”，不要当成愿望清单。越具体，越有效。",
    sourceName: "AI圈编辑部",
    author: "站长",
    tags: ["Cursor", "AI编程", "提示词", "工程效率"],
    createdAt: "2026-05-15T22:05:00+08:00",
    likesCount: 826,
    commentsCount: 72,
    savesCount: 511,
    featured: true,
  },
  {
    id: "midjourney-style-library",
    type: "tool",
    title: "Midjourney V6 摄影级提示词模板库开放下载",
    summary:
      "一份面向电商、人物肖像、室内设计和产品海报的提示词模板库在社区走红，适合快速建立视觉风格基准。",
    content:
      "这套模板库把常见商业视觉场景拆成镜头语言、光线、材质、构图和后期风格几部分，用户只需要替换主体和用途，就能得到比较稳定的摄影感输出。\n\n它不是简单堆砌关键词，而是把不同垂直场景的视觉参数整理成可复用结构。例如电商产品强调干净背景和材质反光，人物肖像强调镜头焦段和肤色细节，室内设计则更关注空间层次和自然光。\n\n对于内容团队来说，这类模板库的价值在于统一出图标准，而不是单张图多惊艳。",
    whyItMatters:
      "视觉生成正在从个人试验进入团队流程，模板化会成为降低沟通成本的关键。",
    editorComment:
      "如果你做自媒体或电商，不妨为自己的品牌建立 10 个固定视觉模板，比每次从零写提示词稳定得多。",
    sourceName: "PromptHero",
    sourceUrl: "https://prompthero.com",
    tags: ["Midjourney", "提示词", "设计", "模板"],
    createdAt: "2026-05-15T18:15:00+08:00",
    likesCount: 564,
    commentsCount: 41,
    savesCount: 302,
  },
  {
    id: "clay-ai-prospecting",
    type: "product",
    title: "Clay 推出 AI Prospecting 2.0：自动找线索、补全画像并生成触达文案",
    summary:
      "面向 B2B 增长团队的新功能把线索发现、数据清洗、个性化邮件和 CRM 同步打包成一个自动化流程。",
    content:
      "Clay 的新版本将多个增长步骤串联在一起：用户输入目标客户画像后，系统会自动寻找潜在线索，补全公司规模、岗位、社媒动态和技术栈等信息，并生成个性化触达文案。\n\n相比传统销售工具，新版本更强调“研究过程自动化”。它并不只是帮你写邮件，而是先判断为什么这个客户值得联系，再选择合适切入点。\n\n这类产品会持续挤压初级 SDR 的重复工作，但也会让小团队拥有过去需要完整销售运营团队才能搭建的线索系统。",
    whyItMatters:
      "AI 正在把 B2B 增长的门槛从人力规模转移到策略和数据质量。",
    editorComment:
      "产品机会在于垂直化。Clay 做通用增长，很多行业还需要自己的“AI 销售研究员”。",
    sourceName: "Product Hunt",
    sourceUrl: "https://www.producthunt.com",
    tags: ["Clay", "B2B", "增长", "自动化"],
    createdAt: "2026-05-15T15:20:00+08:00",
    likesCount: 721,
    commentsCount: 63,
    savesCount: 188,
    featured: true,
  },
  {
    id: "solo-founder-ai-course",
    type: "case",
    title: "一人团队用 AI 做出月入 6 万的行业课程资料库",
    summary:
      "一位独立创作者把公开资料、访谈和案例用 AI 整理成可订阅资料库，3 个月拿到第一批付费用户。",
    content:
      "这个案例的核心不是做了一个复杂产品，而是把某个小行业里分散、难搜索、难理解的信息重新组织了一遍。创作者先用 AI 批量整理公开资料，再通过人工筛选补上真实经验，最终形成按主题、阶段和场景分类的课程资料库。\n\n用户付费的原因也很直接：他们不是为 AI 生成内容付费，而是为节省筛选时间和获得可信结构付费。\n\n这类模式特别适合知识密集但信息混乱的垂直行业，例如跨境电商、线下门店运营、法律合同模板、留学申请、B2B 销售脚本等。",
    whyItMatters:
      "AI 副业不一定要做工具，也可以做高质量信息重组。真正稀缺的是选题、判断和持续更新能力。",
    editorComment:
      "这是普通人更现实的 AI 机会：不要试图做“万能平台”，先做一个足够窄、足够有用的资料产品。",
    sourceName: "Indie Hackers",
    sourceUrl: "https://www.indiehackers.com",
    author: "Lynn",
    tags: ["独立开发", "副业", "知识产品", "创作者"],
    createdAt: "2026-05-15T13:10:00+08:00",
    likesCount: 938,
    commentsCount: 117,
    savesCount: 439,
  },
  {
    id: "gemini-ultra-multimodal",
    type: "news",
    title: "DeepMind 发布新一代多模态模型：强化长上下文与代码推理",
    summary:
      "新模型在多项基准测试中刷新记录，重点提升长视频理解、复杂代码生成和跨模态检索能力。",
    content:
      "DeepMind 新模型延续原生多模态路线，可以在统一上下文中处理文本、图像、音频和视频序列。官方演示展示了它在长视频检索、实验文档理解和大型代码库修改方面的能力。\n\n与上一代模型相比，这次更新更强调长上下文中的稳定推理。模型不仅能回答局部问题，还能跨越大量资料寻找因果关系和异常线索。\n\n企业用户可能会优先把它用于知识库问答、研发文档分析、客服质检和代码迁移等任务。",
    whyItMatters:
      "长上下文与多模态能力会推动 AI 从内容生成走向知识检索、复杂分析和流程协作。",
    editorComment:
      "未来模型竞争会越来越像基础设施竞争。对应用开发者来说，关键是把模型能力包装进清晰的业务入口。",
    sourceName: "DeepMind Blog",
    sourceUrl: "https://deepmind.google",
    tags: ["DeepMind", "多模态", "长上下文", "代码"],
    createdAt: "2026-05-14T20:30:00+08:00",
    likesCount: 1124,
    commentsCount: 134,
    savesCount: 298,
    featured: true,
  },
  {
    id: "notion-ai-database-agents",
    type: "product",
    title: "Notion AI Agents 支持跨数据库执行任务，团队知识库开始自动流动",
    summary:
      "用户可以让 AI 在多个页面和数据库之间查找信息、更新状态、生成周报和提醒负责人。",
    content:
      "Notion 正在把 AI 从编辑器里的写作助手推进到工作空间里的执行者。新功能允许用户创建基于数据库的自动任务，例如从会议记录中抽取待办，更新项目状态，并汇总成周报。\n\n这类功能的关键挑战是权限、可追踪性和错误恢复。Notion 采用可审阅的执行日志，让用户看到 AI 做了哪些改动。\n\n对于知识管理工具而言，AI 的价值不再只是“帮我写一段”，而是让沉睡在页面里的信息自动进入工作流。",
    whyItMatters:
      "协作文档会成为 AI Agent 的天然入口，因为团队上下文已经在那里。",
    editorComment:
      "知识库产品的下一步不是更强编辑器，而是更懂团队节奏的自动化助手。",
    sourceName: "Notion Updates",
    sourceUrl: "https://www.notion.so",
    tags: ["Notion", "Agent", "知识管理", "团队协作"],
    createdAt: "2026-05-14T16:45:00+08:00",
    likesCount: 642,
    commentsCount: 58,
    savesCount: 221,
  },
  {
    id: "ai-search-stack",
    type: "skill",
    title: "给个人知识库加 AI 搜索：RAG 不一定复杂，先做好这 4 步",
    summary:
      "从文档切分、元数据、召回测试和答案引用开始，小团队也能做出足够可用的知识库问答。",
    content:
      "很多人在搭建 RAG 时一开始就纠结向量数据库和模型参数，反而忽略了更基础的资料组织。可用的 AI 搜索至少需要四步：干净的文档切分、可靠的元数据、可复现的召回测试，以及答案中的来源引用。\n\n文档切分决定模型能不能拿到完整语义，元数据决定用户能不能按时间、项目、来源过滤，召回测试决定系统是否稳定，引用则决定答案是否可信。\n\n对于个人和小团队，可以先用少量高质量文档验证效果，再逐步扩展数据量。",
    whyItMatters:
      "AI 搜索是很多内部工具的入口能力，但真正影响体验的往往是资料工程，而不是模型炫技。",
    editorComment:
      "RAG 的第一原则：先让用户相信答案从哪里来，再追求回答多聪明。",
    sourceName: "AI圈技巧",
    author: "站长",
    tags: ["RAG", "知识库", "搜索", "效率"],
    createdAt: "2026-05-14T11:30:00+08:00",
    likesCount: 488,
    commentsCount: 36,
    savesCount: 277,
  },
  {
    id: "perplexity-shopping",
    type: "tool",
    title: "Perplexity Shopping 开始支持中文商品对比和购买建议",
    summary:
      "用户可以用自然语言描述预算和需求，系统会对比价格、参数、评价与替代选项。",
    content:
      "Perplexity 的购物搜索功能开始支持更多中文商品查询。用户可以输入“5000 元以内适合剪辑的轻薄本”这样的需求，系统会生成候选清单、参数对比和购买建议。\n\n与传统搜索不同，这类 AI 购物助手更像一个研究员，会主动解释为什么某些商品不适合你，也会提醒隐藏成本和替代方案。\n\n不过，价格更新、推广内容识别和评价真实性仍然是关键问题。用户仍需要在购买前核对平台信息。",
    whyItMatters:
      "AI 搜索正在切入高商业价值场景。导购、比价和消费决策会是搜索产品的重要战场。",
    editorComment:
      "中文导购场景很大，但要做得可信，必须把数据来源和商业利益关系讲清楚。",
    sourceName: "Perplexity Labs",
    sourceUrl: "https://www.perplexity.ai",
    tags: ["Perplexity", "AI搜索", "购物", "消费决策"],
    createdAt: "2026-05-13T19:50:00+08:00",
    likesCount: 367,
    commentsCount: 29,
    savesCount: 96,
  },
  {
    id: "designer-ai-portfolio",
    type: "case",
    title: "设计师把 AI 工作流写进作品集，面试转化率提高 40%",
    summary:
      "一位产品设计师在作品集中展示从洞察、草图、生成图到原型验证的完整 AI 协作流程，明显提升了雇主兴趣。",
    content:
      "这个案例说明，AI 能力不应该只写在简历技能栏里，而应该体现在作品过程里。设计师把一个改版项目拆成用户研究、情绪板、界面探索、交互原型和可用性测试几个阶段，并展示每个阶段如何与 AI 协作。\n\n雇主反馈最感兴趣的不是某张视觉图，而是候选人如何判断 AI 产出、如何迭代、如何把生成内容转化成真实设计决策。\n\n这也给很多创作者一个启发：展示 AI 工作流，比简单展示 AI 作品更有说服力。",
    whyItMatters:
      "AI 时代的个人竞争力会从“会不会用工具”转向“能不能把工具变成稳定方法”。",
    editorComment:
      "把你的提示词、筛选标准和失败迭代都放进案例里，那些比最终图更能体现专业度。",
    sourceName: "UX Collective",
    sourceUrl: "https://uxdesign.cc",
    author: "Kira",
    tags: ["设计师", "作品集", "AI工作流", "求职"],
    createdAt: "2026-05-13T14:05:00+08:00",
    likesCount: 514,
    commentsCount: 44,
    savesCount: 203,
  },
  {
    id: "opensource-small-models",
    type: "opinion",
    title: "小模型不是退而求其次，而是很多 AI 产品的最佳默认值",
    summary:
      "在客服、表单处理、分类和内部助手场景中，小模型往往以更低成本、更快速度和更强可控性胜出。",
    content:
      "大模型负责打开想象空间，小模型负责让产品跑得起来。很多企业场景并不需要最强推理，而需要稳定、便宜、可私有化和低延迟。\n\n例如工单分类、敏感词识别、表单抽取、客服意图判断和简单内容改写，小模型配合规则和少量微调就能完成得很好。真正复杂的问题可以再路由给更强模型。\n\n这种“大小模型协作”的架构会成为很多 AI 应用控制成本的基础。",
    whyItMatters:
      "AI 应用的商业化离不开成本结构。会用小模型，往往比只会调用最贵模型更重要。",
    editorComment:
      "产品经理在选模型时应该问两个问题：这个任务真的需要最强模型吗？失败成本能不能被流程兜住？",
    sourceName: "Latent Space",
    sourceUrl: "https://www.latent.space",
    tags: ["小模型", "开源模型", "成本优化", "产品架构"],
    createdAt: "2026-05-12T21:15:00+08:00",
    likesCount: 789,
    commentsCount: 92,
    savesCount: 319,
  },
];

export const mockComments: Record<string, Comment[]> = {
  "sora-4k-timeline": [
    {
      id: "c-sora-1",
      postId: "sora-4k-timeline",
      author: "VideoMaker",
      content: "如果时间轴控制真的稳定，短视频广告制作会被重写一遍。",
      createdAt: "2026-05-16T09:05:00+08:00",
      likesCount: 24,
      avatarText: "V",
    },
    {
      id: "c-sora-2",
      postId: "sora-4k-timeline",
      author: "阿北",
      content: "最期待角色一致性，之前生成连续剧情太容易崩。",
      createdAt: "2026-05-16T09:12:00+08:00",
      likesCount: 18,
      avatarText: "北",
    },
  ],
  "agentic-workflows-ng": [
    {
      id: "c-agent-1",
      postId: "agentic-workflows-ng",
      author: "产品小周",
      content: "今年看了很多 Agent 产品，真正跑通工作流的还是少数。",
      createdAt: "2026-05-16T08:20:00+08:00",
      likesCount: 42,
      avatarText: "周",
    },
  ],
  "solo-founder-ai-course": [
    {
      id: "c-case-1",
      postId: "solo-founder-ai-course",
      author: "独立开发者 Leo",
      content: "这个方向比做通用工具现实，关键是选到付费意愿强的细分人群。",
      createdAt: "2026-05-15T15:40:00+08:00",
      likesCount: 31,
      avatarText: "L",
    },
  ],
};

export const hotTags = [
  "Agent",
  "AI视频",
  "Cursor",
  "提示词",
  "独立开发",
  "RAG",
  "产品机会",
  "小模型",
  "创作者",
  "自动化",
];

export function getPostById(posts: Post[], id: string) {
  return posts.find((post) => post.id === id);
}
