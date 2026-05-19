import type { Post } from "@/lib/mock-data";

type InsightTheme =
  | "media"
  | "agent"
  | "model"
  | "research"
  | "robotics"
  | "infra"
  | "business"
  | "devtools"
  | "general-ai";

type PostInsight = {
  subject: string;
  theme: InsightTheme;
  paragraphs: string[];
  evidence: string[];
  summary: string;
  whyItMatters: string;
  editorComment: string;
};

const SENTENCE_SPLIT_REGEX = /(?<=[。！？!?；;])\s*/;
const METADATA_PREFIXES = ["原始来源：", "原文时间：", "抓取时间：", "说明："];
const NOISE_PARAGRAPH_REGEXES = [
  /^作者[｜:]/,
  /^编辑[｜:]/,
  /^来源[：:]/,
  /^本文图片来自/,
  /^扫码关注量子位/,
 /^量子位\s+QbitAI$/,
  /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(日)?$/,
  /^\d{1,2}:\d{2}(:\d{2})?$/,
  /^评论区$/,
  /^暂无评论$/,
  /^\d+\s*\d*$/,
];

const THEME_KEYWORDS: Record<InsightTheme, RegExp[]> = {
  media: [
    /动漫|漫剧|短剧|视频生成|院线|影视化|ip改编|创作者|分镜|长内容/i,
  ],
  agent: [/agent|智能体|工作流|自动化|copilot|助手|任务执行/i],
  model: [/大模型|模型|gpt|claude|gemini|多模态|推理|生成式|aigc|openai/i],
  research: [/论文|基准|benchmark|arxiv|研究|实验|评测|alignment|safety|rag/i],
  robotics: [/机器人|具身|机械臂|robot|robotics/i],
  infra: [/芯片|算力|gpu|推理部署|inference|训练|nvidia|加速/i],
  business: [/营收|收入|订阅|票房|商业化|变现|客户|采购|融资|付费/i],
  devtools: [/开发者|编程|代码|sdk|api|github|开源|工作台|插件/i],
  "general-ai": [/ai|人工智能/i],
};

export function buildGeneratedPostCopy({
  title,
  rawContent,
  fallbackSummary,
}: {
  title: string;
  rawContent: string;
  fallbackSummary?: string;
}) {
  const cleanedContent = cleanDisplayContent(rawContent);
  const insight = analyzePostText({
    title,
    content: cleanedContent,
    fallbackSummary,
  });

  return {
    summary: insight.summary,
    content: insight.paragraphs.join("\n\n"),
    whyItMatters: insight.whyItMatters,
    editorComment: insight.editorComment,
  };
}

export function cleanDisplayContent(content: string) {
  return splitParagraphs(content)
    .filter((paragraph) => !METADATA_PREFIXES.some((prefix) => paragraph.startsWith(prefix)))
    .join("\n\n");
}

export function analyzePost(post: Pick<Post, "title" | "summary" | "content">): PostInsight {
  return analyzePostText({
    title: post.title,
    content: cleanDisplayContent(post.content),
    fallbackSummary: post.summary,
  });
}

export function buildRoleComment(post: Pick<Post, "title" | "summary" | "content">, roleId: string) {
  const insight = analyzePost(post);
  const evidence = insight.evidence[0] ?? insight.summary;
  const secondEvidence = insight.evidence[1] ?? evidence;

  switch (roleId) {
    case "product-strategist":
      return buildProductComment(insight.theme, evidence);
    case "indie-hacker":
      return buildIndieComment(insight.theme, evidence);
    case "research-reader":
      return buildResearchComment(insight.theme, evidence);
    case "growth-operator":
      return buildGrowthComment(insight.theme, evidence);
    case "creator-coach":
      return buildCreatorComment(insight.theme, evidence);
    case "risk-observer":
      return buildRiskComment(insight.theme, evidence, secondEvidence);
    default:
      return "我更看重这件事能不能继续外化成稳定动作，而不是停在一次性热点。只要后续没有更明确的交付结果、成本边界或用户反馈，热度很快就会先于价值。";
  }
}

function analyzePostText({
  title,
  content,
  fallbackSummary,
}: {
  title: string;
  content: string;
  fallbackSummary?: string;
}): PostInsight {
  const paragraphs = splitParagraphs(content);
  const bodyText = paragraphs.join("\n");
  const subject = extractSubject(title);
  const theme = detectTheme(`${title}\n${bodyText}`);
  const evidence = extractEvidence(title, paragraphs, theme);
  const summary =
    buildSummary(paragraphs, fallbackSummary) ||
    fallbackSummary?.trim() ||
    `${subject} 的最新 AI 动向。`;

  return {
    subject,
    theme,
    paragraphs,
    evidence,
    summary,
    whyItMatters: buildWhyItMatters(theme, subject, evidence),
    editorComment: buildEditorComment(theme, subject, evidence),
  };
}

function splitParagraphs(content: string) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split(/\n{2,}|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !NOISE_PARAGRAPH_REGEXES.some((regex) => regex.test(paragraph)));
}

function buildSummary(paragraphs: string[], fallbackSummary?: string) {
  const sentences = paragraphs
    .flatMap((paragraph) => paragraph.split(SENTENCE_SPLIT_REGEX))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18);

  const selected = sentences.slice(0, 2).join("");
  const summary = clip(selected, 160);

  if (summary) return summary;
  return fallbackSummary?.trim() ?? "";
}

function extractSubject(title: string) {
  const cleanTitle = title.replace(/[|｜].*$/, "").trim();
  const parts = cleanTitle.split(/[：:]/);
  return (parts[0] || cleanTitle).trim();
}

function detectTheme(text: string): InsightTheme {
  const orderedThemes: InsightTheme[] = [
    "media",
    "agent",
    "robotics",
    "infra",
    "research",
    "devtools",
    "business",
    "model",
    "general-ai",
  ];

  for (const theme of orderedThemes) {
    if (THEME_KEYWORDS[theme].some((regex) => regex.test(text))) return theme;
  }

  return "general-ai";
}

function extractEvidence(title: string, paragraphs: string[], theme: InsightTheme) {
  const themeRegexes = THEME_KEYWORDS[theme];
  const candidates = paragraphs
    .flatMap((paragraph) => paragraph.split(SENTENCE_SPLIT_REGEX))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 20);

  const scored = candidates
    .map((sentence) => ({
      sentence,
      score:
        (/\d/.test(sentence) ? 2 : 0) +
        (themeRegexes.some((regex) => regex.test(sentence)) ? 3 : 0) +
        (title.includes(sentence.slice(0, 10)) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || b.sentence.length - a.sentence.length)
    .map((entry) => entry.sentence);

  const unique = Array.from(new Set(scored)).slice(0, 2);
  return unique.length ? unique : [title];
}

function buildWhyItMatters(theme: InsightTheme, subject: string, evidence: string[]) {
  const primary = clip(evidence[0] ?? subject, 68);

  switch (theme) {
    case "media":
      return `${subject} 这件事的重点不是又多了一条 AIGC 新闻，而是 AI 正在进入内容工业化环节。文中提到“${primary}”，说明平台开始用 AI 去压缩 IP 改编成本、提高长内容产能，并把动画/院线发行纳入一条完整的变现链路。`;
    case "agent":
      return `${subject} 真正重要的地方在于，AI 能力正在从“单轮回答”转向“可执行工作流”。如果文章里的动作能稳定复现，价值就不只是功能升级，而是替代一段人工流程。`;
    case "model":
      return `${subject} 值得跟的不是模型名字本身，而是能力边界有没有向真实场景推进。“${primary}”意味着这条线已经开始影响产品体验、开发范式或多模态交付，不再只是实验室指标。`;
    case "research":
      return `${subject} 的价值在于把研究结论往可验证能力上推进。真正该看的不是论文 headline，而是“${primary}”这种可度量信号，它决定这项能力能不能进入后续产品或工程栈。`;
    case "robotics":
      return `${subject} 说明 AI 价值正在往物理世界延伸。只要文章里提到的能力能稳定落到感知、控制或执行链路，机器人和具身系统的商业化节奏就会明显加快。`;
    case "infra":
      return `${subject} 重要的不是基础设施概念本身，而是算力、推理成本和交付效率是否被重新改写。“${primary}”这类信号通常直接决定 AI 产品能不能大规模落地。`;
    case "devtools":
      return `${subject} 对开发者更重要的点在于，它是否把复杂能力封装成更低门槛的工程入口。只要交付链路更短、复用性更强，这类能力就会快速渗透到真实团队工作流。`;
    case "business":
      return `${subject} 背后反映的是 AI 已经开始改变成本结构和收入模型。文章里出现“${primary}”这种业务动作时，通常意味着平台正在验证新的付费链路，而不是停留在概念层。`;
    default:
      return `${subject} 重要的地方在于，它把 AI 从抽象趋势往具体业务动作又推进了一步。判断它值不值得持续跟，关键要看文中这类信号能否继续放大并形成可复制结果。`;
  }
}

function buildEditorComment(theme: InsightTheme, subject: string, evidence: string[]) {
  const primary = clip(evidence[0] ?? subject, 72);
  const secondary = clip(evidence[1] ?? evidence[0] ?? subject, 72);

  switch (theme) {
    case "media":
      return `${subject} 最值得盯的是三条线：第一，IP 授权有没有继续向自制和平台级发行延伸；第二，“${primary}”这种长内容生产能力能否稳定到院线级一致性；第三，是否跑出票房、订阅或拉新的真实回款。只要这三条线有两条成立，AI 动漫就不是试水，而是在重写网文 IP 的变现顺序。`;
    case "agent":
      return `${subject} 这类文章不要只看功能描述，要看它到底接管了哪一步人工操作。我的判断标准是：有没有明确输入输出、有没有跨系统执行、出了错怎么兜底。若这些环节没有闭环，再强的 Agent 叙事也容易停在演示层。`;
    case "model":
      return `${subject} 这条最该拆的是“能力提升来自模型本身，还是来自工程编排”。如果只是提示词包装或场景裁剪，护城河不会太深；如果“${primary}”已经能稳定复现，后续就要看接入成本、延迟和权限边界。`;
    case "research":
      return `${subject} 不要只被结论带着走，先看方法和评测边界。尤其是“${primary}”和“${secondary}”这类描述，后面最好有公开 benchmark、复现实验或失败样本，否则很容易高估真实可用性。`;
    case "robotics":
      return `${subject} 这条真正要看的不是演示效果，而是系统稳定性和执行成本。只要感知、规划、控制三段里任何一段需要大量人工补偿，商业化节奏就会被拖慢。`;
    case "infra":
      return `${subject} 的含金量取决于两个指标：一是把单次推理或训练成本压下去多少，二是把部署复杂度降低多少。如果文章后续能给出更明确的吞吐、延迟或成本对比，这条线才有持续跟踪价值。`;
    case "devtools":
      return `${subject} 对开发者最有价值的，不是它“支持 AI”这件事，而是能不能减少接入和调试成本。我的关注点会放在：默认工作流够不够顺、团队协作有没有收益、出问题时能不能快速定位。`;
    case "business":
      return `${subject} 这类新闻最怕只讲故事不讲数字。我的建议是继续盯“${primary}”背后的投入产出比，再看“${secondary}”是否会变成持续动作；如果后续没有更明确的转化、留存或采购信号，热度很容易跑在业务前面。`;
    default:
      return `${subject} 继续观察时，不要停留在标题层。更有价值的是把文章里的关键动作拆成“谁在做、为谁做、凭什么现在做”三件事，只要这三点能讲清楚，后续是否值得跟进就会非常明确。`;
  }
}

function buildProductComment(
  theme: InsightTheme,
  evidence: string,
) {
  if (theme === "media") {
    return "从产品视角看，真正有价值的不是又多了一个内容案例，而是平台开始把生产能力内置到变现链里。只要长内容供给速度和一致性稳定下来，上游 IP、中台制作和下游发行会被重新串成一套产品。";
  }

  void evidence;
  return `我会直接看这件事有没有替代掉一段高频旧流程。只要接入后还需要大量人工补洞，产品价值就会被高估；只有当标准化能力能稳定产出结果时，转化和付费才会跟上。`;
}

function buildIndieComment(theme: InsightTheme, evidence: string) {
  if (theme === "media") {
    return "如果让我做，我不会碰大而全平台，而是盯住流程里最费时间、最难标准化的一段先做窄工具。先把单点效率拉起来，再考虑往完整工作流扩，命中率会高得多。";
  }

  void evidence;
  return "这类机会更适合拆成一个很窄的验证题。先补位某个具体环节，证明能省时间、降成本或减少返工，再去谈平台化；一上来做大全套，基本都会被实施成本拖死。";
}

function buildResearchComment(theme: InsightTheme, evidence: string) {
  if (theme === "media") {
    return "我更关心的是约束条件有没有被正面解决。能出一次效果不难，难的是连续场景下的一致性、可控性和返工成本；这些问题不解掉，任何演示都还谈不上真正可交付。";
  }

  void evidence;
  return "我不会先看结论，而是先看方法边界和失败条件。凡是没有评测口径、没有复现条件、没有成本描述的能力，落到真实场景里几乎都会被打折。";
}

function buildGrowthComment(theme: InsightTheme, evidence: string) {
  if (theme === "media") {
    return "增长侧最看重的不是热点本身，而是实验频率能不能被放大。只要内容供给速度和题材测试速度一起提上来，获客、留存和转化的验证周期就会明显缩短。";
  }

  void evidence;
  return "这类能力只有在用户能快速感知结果时，增长价值才成立。技术叙事本身带不来持续传播，能打动用户的永远是更快看到收益、更低理解成本和更顺的转化路径。";
}

function buildCreatorComment(theme: InsightTheme, evidence: string) {
  if (theme === "media") {
    return "对创作者来说，最有价值的不是转述新闻，而是把这类变化拆成方法论。只要能解释清楚为什么这个场景先跑通、卡点在哪、普通人能怎么借势，内容就会比泛资讯更有传播力。";
  }

  void evidence;
  return "我会把这类内容直接翻译成可执行建议，而不是重复原文。真正能带来传播和信任的，是适合谁用、怎么落地、有哪些坑，而不是把新闻重新说一遍。";
}

function buildRiskComment(
  theme: InsightTheme,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return "这条线的风险不在热度，而在质量失控后能不能收住。只要版权、品控和一致性还高度依赖人工补救，规模一上来，问题就会比效率收益先暴露。";
  }

  void evidence;
  void secondEvidence;
  return "我最担心的不是技术失误，而是预期先跑到交付前面。只要没有稳定证据支撑，就要默认能力会被高估、成本会被低估，最后很容易变成只能演示不能落地。";
}

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
