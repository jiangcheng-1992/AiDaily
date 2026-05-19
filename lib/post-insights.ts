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
  const subject = insight.subject;
  const evidence = insight.evidence[0] ?? insight.summary;
  const secondEvidence = insight.evidence[1] ?? evidence;

  switch (roleId) {
    case "product-strategist":
      return buildProductComment(insight.theme, subject, evidence, secondEvidence);
    case "indie-hacker":
      return buildIndieComment(insight.theme, subject, evidence);
    case "research-reader":
      return buildResearchComment(insight.theme, subject, evidence);
    case "growth-operator":
      return buildGrowthComment(insight.theme, subject, evidence);
    case "creator-coach":
      return buildCreatorComment(insight.theme, subject, evidence);
    case "risk-observer":
      return buildRiskComment(insight.theme, subject, evidence, secondEvidence);
    default:
      return `${subject} 这条里最有价值的不是标题本身，而是「${clip(evidence, 56)}」。后续判断它值不值得持续跟，要看这条线能不能从一次性新闻变成可重复验证的产品或业务动作。`;
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
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 这个动作最像是在把网文 IP 的变现链从“授权”改成“自带生产能力”。文里提到“${clip(evidence, 52)}”，如果后续真能跑通长内容和院线发行，平台就不只是内容分发方，而是在往更上游的内容工厂走。`;
  }

  return `${subject} 从产品角度最值得看的，是它到底替代了哪一步旧流程。文中“${clip(evidence, 52)}”说明团队不是在堆概念，而是在争取把某个高频动作做成标准化能力；接下来就看“${clip(secondEvidence, 52)}”能不能带来稳定转化。`;
}

function buildIndieComment(theme: InsightTheme, subject: string, evidence: string) {
  if (theme === "media") {
    return `${subject} 给独立开发者的启发，不是去硬做一个“大而全”的视频平台，而是切其中一段能力做窄 MVP，比如角色一致性检测、分镜生成、IP 改编工作台。文里“${clip(evidence, 50)}”已经说明这个链路里有明确痛点。`;
  }

  return `${subject} 这条更适合拆成一个很窄的验证题：围绕“${clip(evidence, 48)}”做工具层或工作流层补位。先做能省时间的单点，而不是一上来就做完整平台，命中率会高很多。`;
}

function buildResearchComment(theme: InsightTheme, subject: string, evidence: string) {
  if (theme === "media") {
    return `${subject} 这里最关键的技术约束其实已经写在文里了：“${clip(evidence, 58)}”。换句话说，问题不是 AI 能不能出片，而是长内容里人物和场景的一致性能不能稳定到可交付，这决定了它能不能从 demo 走向正式制作。`;
  }

  return `${subject} 这条最好别只看结果，要看“${clip(evidence, 56)}”背后有没有稳定方法。凡是没有评测边界、没有失败条件、没有成本描述的能力，都很容易在真实场景里打折。`;
}

function buildGrowthComment(theme: InsightTheme, subject: string, evidence: string) {
  if (theme === "media") {
    return `${subject} 对增长侧的价值，在于内容供给速度和题材测试速度可能会一起提升。文里“${clip(evidence, 52)}”意味着平台可以更快验证哪些 IP 题材值得推，增长团队拿到的就不只是内容，而是更高频的实验素材。`;
  }

  return `${subject} 这类信息的增长价值，不在热点本身，而在是否能缩短从能力上线到用户感知的路径。“${clip(evidence, 52)}”如果能继续外化成案例和结果，传播效率会比纯技术叙事高很多。`;
}

function buildCreatorComment(theme: InsightTheme, subject: string, evidence: string) {
  if (theme === "media") {
    return `${subject} 很适合拆成一个有传播力的选题：AI 不是把动画“自动化”了，而是在重做 IP 改编流水线。尤其“${clip(evidence, 54)}”这个点，能直接讲清楚为什么今天先火的是 AI 动漫，而不是 AI 仿真人。`;
  }

  return `${subject} 对创作者最有价值的，是把这条内容翻译成可执行的方法。文里“${clip(evidence, 52)}”就是现成的切入点，拿它做一篇“怎么用、适合谁、边界在哪”的拆解，比转述新闻更有用。`;
}

function buildRiskComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `${subject} 也要看风险边界：一边是“${clip(evidence, 52)}”带来的产能提升，另一边是 IP 版权、内容品控和角色一致性失控。只要“${clip(secondEvidence, 48)}”还高度依赖人工补救，这条线的规模化就会被质量问题卡住。`;
  }

  return `${subject} 这里的风险不只是技术失误，更是预期和交付之间的落差。只要“${clip(evidence, 52)}”还没有稳定证据支撑，就要警惕能力被高估、成本被低估，最后变成只能演示不能落地。`;
}

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
