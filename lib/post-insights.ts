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
  const evidence = clip(insight.evidence[0] ?? insight.summary, 82);
  const secondEvidence = clip(insight.evidence[1] ?? evidence, 82);

  switch (roleId) {
    case "product-strategist":
      return buildProductComment(insight.theme, insight.subject, evidence, secondEvidence);
    case "indie-hacker":
      return buildIndieComment(insight.theme, insight.subject, evidence, secondEvidence);
    case "research-reader":
      return buildResearchComment(insight.theme, insight.subject, evidence, secondEvidence);
    case "growth-operator":
      return buildGrowthComment(insight.theme, insight.subject, evidence, secondEvidence);
    case "creator-coach":
      return buildCreatorComment(insight.theme, insight.subject, evidence, secondEvidence);
    case "risk-observer":
      return buildRiskComment(insight.theme, insight.subject, evidence, secondEvidence);
    default:
      return `${insight.subject} 这条不能只停在标题层，我更看“${evidence}”能不能继续演变成稳定动作。只要后续没有更明确的交付结果、成本边界或用户反馈，热度很快就会先于价值。`;
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
  const secondary = clip(evidence[1] ?? evidence[0] ?? subject, 68);

  switch (theme) {
    case "media":
      return `${subject} 这条值得跟，不是因为又多了一条 AIGC 资讯，而是文中明确出现了“${primary}”和“${secondary}”这类生产或发行动作。它说明 AI 已开始碰到内容工业化最难的那部分：既要提产能，还要把质量和回款链路一起打通。`;
    case "agent":
      return `${subject} 真正重要的地方在于，文中不是只写“更聪明”，而是给出了“${primary}”这类可执行动作。只要这些动作能持续复现，AI 的价值就不再是聊天效果，而是开始替代一段真实人工流程。`;
    case "model":
      return `${subject} 值得跟的不是模型名次本身，而是“${primary}”这类结果是否真的把能力边界往真实场景推了一步。只要模型优势开始落到产品体验、服务交付或多模态能力上，它就不再只是排行榜新闻。`;
    case "research":
      return `${subject} 的价值在于把研究结论往可验证能力上推进。文章里真正该盯的是“${primary}”和“${secondary}”这种可度量信号，它们决定这项能力能不能进入后续产品或工程栈。`;
    case "robotics":
      return `${subject} 说明 AI 价值正在往物理世界延伸。文中如果已经出现“${primary}”这类感知、控制或执行细节，就代表它离可交付系统更近一步，而不只是演示视频。`;
    case "infra":
      return `${subject} 重要的不是基础设施概念本身，而是“${primary}”这类成本、吞吐或交付效率信号有没有出现。只要基础设施指标被改写，AI 产品的落地上限就会跟着改变。`;
    case "devtools":
      return `${subject} 对开发者更重要的点在于，它是否把复杂能力封装成更低门槛的工程入口。文中的“${primary}”如果代表接入链路更短、调试更省或复用更强，这类能力就会快速渗透到真实团队工作流。`;
    case "business":
      return `${subject} 背后反映的是 AI 已经开始改变成本结构和收入模型。文章里出现“${primary}”这种业务动作时，通常意味着平台正在验证新的付费链路，而不是停留在概念层。`;
    default:
      return `${subject} 重要的地方在于，它把 AI 从抽象趋势往具体业务动作又推进了一步。像“${primary}”这样的信号如果后续还能被放大并形成可复制结果，这条线才真正值得持续跟。`;
  }
}

function buildEditorComment(theme: InsightTheme, subject: string, evidence: string[]) {
  const primary = clip(evidence[0] ?? subject, 72);
  const secondary = clip(evidence[1] ?? evidence[0] ?? subject, 72);

  switch (theme) {
    case "media":
      return `${subject} 这条我不会只看“做出来了没有”，而会盯两件事：一是“${primary}”能不能持续稳定，二是“${secondary}”最后有没有落到发行、订阅或回款。只要生产效率能被放大但品控和回收链跟不上，这类故事就还是偏试水。`;
    case "agent":
      return `${subject} 这类内容不要只看功能描述，要看“${primary}”到底接管了哪一步人工操作，以及“${secondary}”是不是可重复动作。我的判断标准很简单：输入输出是否清楚、跨系统执行有没有闭环、出错后谁兜底。`;
    case "model":
      return `${subject} 这条最该拆的是：能力提升到底来自模型本身，还是来自工程编排。像“${primary}”这样的结果如果只是包装出来的，护城河不会太深；如果它已经能稳定复现，后续就该继续盯延迟、接入成本和权限边界。`;
    case "research":
      return `${subject} 不要只被结论带着走，先看方法和评测边界。尤其是“${primary}”和“${secondary}”这类描述，后面最好有公开 benchmark、复现实验或失败样本，否则很容易高估真实可用性。`;
    case "robotics":
      return `${subject} 这条真正要看的不是演示效果，而是系统稳定性和执行成本。文中如果“${primary}”只是单次成功案例，而“${secondary}”没有体现持续执行能力，那商业化节奏还是会被拖慢。`;
    case "infra":
      return `${subject} 的含金量取决于两个指标：一是把单次推理或训练成本压下去多少，二是把部署复杂度降低多少。像“${primary}”这种描述如果后续能补上吞吐、延迟或成本对比，这条线才真正有持续跟踪价值。`;
    case "devtools":
      return `${subject} 对开发者最有价值的，不是它“支持 AI”这件事，而是“${primary}”有没有真的减少接入和调试成本。我的关注点会放在：默认工作流够不够顺、团队协作有没有收益、出问题时能不能快速定位。`;
    case "business":
      return `${subject} 这类新闻最怕只讲故事不讲数字。我的建议是继续盯“${primary}”背后的投入产出比，再看“${secondary}”是否会变成持续动作；如果后续没有更明确的转化、留存或采购信号，热度很容易跑在业务前面。`;
    default:
      return `${subject} 继续观察时，不要停留在标题层。更有价值的是把“${primary}”和“${secondary}”这两个动作拆成“谁在做、为谁做、凭什么现在做”三件事，只要这三点能讲清楚，后续是否值得跟进就会非常明确。`;
  }
}

function buildProductComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 这条我最看“${evidence}”能不能变成稳定供给，再由“${secondEvidence}”接到发行或订阅。对产品来说，真正的价值不是又多一个案例，而是生产能力开始进入可回款链路。`;
  }

  return `${subject} 这条我会直接看“${evidence}”有没有替代掉一段高频旧流程。如果接入后还需要大量人工补洞，产品价值就会被高估；只有当这个动作能稳定复现，转化和付费才会跟上。`;
}

function buildIndieComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 如果让我做，我不会碰大而全平台，而会盯“${evidence}”里最费时间、最难标准化的那一段先做窄工具。先把单点效率拉起来，再看“${secondEvidence}”能不能接成工作流，命中率会高得多。`;
  }

  return `${subject} 这类机会更适合拆成一个很窄的验证题。先围绕“${evidence}”补位某个具体环节，证明能省时间、降成本或减少返工，再去谈平台化；一上来做大全套，基本都会被实施成本拖死。`;
}

function buildResearchComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 我更关心的是约束条件有没有被正面解决。像“${evidence}”这种结果能出一次不难，难的是连续场景下还能否保持一致性、可控性和返工成本；这些问题不解掉，任何演示都还谈不上真正可交付。`;
  }

  return `${subject} 我不会先看结论，而是先看方法边界和失败条件。文中如果重点落在“${evidence}”和“${secondEvidence}”，后面最好有评测口径、复现条件或成本描述，否则落到真实场景里几乎都会被打折。`;
}

function buildGrowthComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 从增长侧看，重点不是热点本身，而是“${evidence}”能不能让实验频率被放大。只要内容供给速度和题材测试速度一起提上来，再由“${secondEvidence}”接住分发，获客和转化验证周期就会明显缩短。`;
  }

  return `${subject} 这类能力只有在用户能快速感知结果时，增长价值才成立。像“${evidence}”这种动作如果只是技术叙事，传播很快就会衰减；只有用户更快看到收益、更低理解成本和更顺转化，增长才成立。`;
}

function buildCreatorComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 对创作者来说，最有价值的不是转述新闻，而是把“${evidence}”和“${secondEvidence}”拆成方法论。只要能解释清楚为什么这个场景先跑通、卡点在哪、普通人能怎么借势，这类内容就会比泛资讯更有传播力。`;
  }

  return `${subject} 我会把这类内容直接翻译成可执行建议，而不是重复原文。围绕“${evidence}”去解释适合谁用、怎么落地、有哪些坑，才是真正能带来传播和信任的信息增量。`;
}

function buildRiskComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 这条线的风险不在热度，而在“${evidence}”和“${secondEvidence}”背后那套质量控制能不能收住。只要版权、品控和一致性还高度依赖人工补救，规模一上来，问题就会比效率收益先暴露。`;
  }

  return `${subject} 我最担心的不是技术失误，而是预期先跑到交付前面。文中如果只有“${evidence}”这类正向描述，而缺少对限制条件和失败边界的交代，就要默认能力会被高估、成本会被低估。`;
}

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
