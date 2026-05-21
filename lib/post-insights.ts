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

type RoleCommentId =
  | "product-strategist"
  | "indie-hacker"
  | "research-reader"
  | "growth-operator"
  | "creator-coach"
  | "risk-observer";

type RoleEvidenceSelection = {
  primary: string;
  secondary: string;
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

export function buildRoleComment(
  post: Pick<Post, "title" | "summary" | "content">,
  roleId: string,
  options?: { variant?: number },
) {
  const insight = analyzePost(post);
  const selectedEvidence = pickRoleEvidence(insight, roleId as RoleCommentId, options?.variant ?? 0);
  const evidence = clip(selectedEvidence.primary, 82);
  const secondEvidence = clip(selectedEvidence.secondary, 82);

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

function pickRoleEvidence(
  insight: PostInsight,
  roleId: RoleCommentId,
  variant = 0,
): RoleEvidenceSelection {
  const candidates = collectRoleEvidenceCandidates(insight, roleId);
  const primary =
    candidates[variant] ??
    candidates[0] ??
    insight.evidence[variant] ??
    insight.evidence[0] ??
    insight.summary;
  const secondary =
    candidates.find((sentence) => sentence !== primary) ??
    insight.evidence.find((sentence) => sentence !== primary) ??
    insight.summary;

  return { primary, secondary };
}

function collectRoleEvidenceCandidates(insight: PostInsight, roleId: RoleCommentId) {
  const title = insight.subject;
  const sentences = [
    ...insight.evidence,
    ...insight.paragraphs.flatMap((paragraph) => paragraph.split(SENTENCE_SPLIT_REGEX)),
  ]
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 18);

  const seen = new Set<string>();
  const uniqueSentences = sentences.filter((sentence) => {
    if (seen.has(sentence)) return false;
    seen.add(sentence);
    return true;
  });

  return uniqueSentences
    .map((sentence, index) => ({
      sentence,
      score: scoreRoleEvidence(sentence, title, roleId),
      index,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.sentence);
}

function scoreRoleEvidence(sentence: string, title: string, roleId: RoleCommentId) {
  const baseScore =
    (/\d/.test(sentence) ? 3 : 0) +
    (title.includes(sentence.slice(0, 10)) ? 1 : 0) +
    (/(发布|上线|支持|实现|覆盖|部署|接入|服务|适配|决策|客户|场景)/.test(sentence) ? 2 : 0);

  switch (roleId) {
    case "product-strategist":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /客户|用户|场景|服务|部署|接入|工作流|平台|付费|交付|适配|覆盖/,
        ])
      );
    case "indie-hacker":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /离线|本地|低功耗|部署|接入|成本|验证|自动化|流程|工作流|硬件/,
        ])
      );
    case "research-reader":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /评测|benchmark|准确|稳定|推理|实验|指标|基准|复现|能力|模型|延迟/,
        ])
      );
    case "growth-operator":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /客户|用户|场景|覆盖|获客|转化|传播|分发|服务|部署|留存|拉新/,
        ])
      );
    case "creator-coach":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /场景|流程|内容|创作|方法|模板|工作流|案例|展示|交付|分镜/,
        ])
      );
    case "risk-observer":
      return (
        baseScore +
        scoreByKeywords(sentence, [
          /不确定|风险|限制|成本|依赖|边界|监管|合规|返工|失败|权限|隐私/,
        ])
      );
    default:
      return baseScore;
  }
}

function scoreByKeywords(sentence: string, patterns: RegExp[]) {
  return patterns.reduce((score, pattern) => score + (pattern.test(sentence) ? 4 : 0), 0);
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
    return `文里提到“${evidence}”，这说明 ${subject} 已经不只是出效果图，而是在摸生产链路。产品视角真正要盯的是“${secondEvidence}”能不能把供给接到发行、订阅或回款上，否则仍然只是演示级能力。`;
  }

  return `文里最有产品含量的是“${evidence}”，因为它指向一段正在被改写的具体流程。我接下来只会继续追“${secondEvidence}”有没有带来更短交付、更少人工介入或更高付费意愿；没有这些结果，功能再新也很难算真价值。`;
}

function buildIndieComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `如果按这篇内容找切口，我会先围绕“${evidence}”做窄工具，而不是做完整内容平台。等“${secondEvidence}”这一步也能接起来，再谈工作流扩展；否则一开始就做大全套，很容易被素材、品控和实施成本拖死。`;
  }

  return `这篇里最适合拿来做 MVP 的不是标题，而是“${evidence}”这个具体环节。我会先验证它能不能把“${secondEvidence}”里的人工动作缩短掉一截，先拿到省时或降本证据，再决定要不要往平台化走。`;
}

function buildResearchComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `“${evidence}”看起来很强，但研究视角会先追问它是不是连续场景下也成立。要是“${secondEvidence}”没有补上稳定性、可控性或返工成本，这种结果更像样片，不足以说明 ${subject} 已经具备可交付性。`;
  }

  return `这篇最该被核验的是“${evidence}”到底在什么条件下成立，以及“${secondEvidence}”有没有公开评测口径。没有失败样本、复现条件或成本边界时，我不会把它当成已成立能力，只会当成值得继续验证的方向。`;
}

function buildGrowthComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `增长侧会盯“${evidence}”能不能把实验频率拉高，而不是只看热度。只要“${secondEvidence}”这一步还能把分发或转化接住，${subject} 才不是单次爆款，而是能持续放大的增长能力。`;
  }

  return `我会把“${evidence}”当成用户第一眼能不能感知收益的地方，再看“${secondEvidence}”会不会拖高理解成本。只有这两个点同时成立，${subject} 才可能从技术叙事变成真正能跑转化和留存的增长抓手。`;
}

function buildCreatorComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `对创作者最能出内容增量的不是标题本身，而是“${evidence}”和“${secondEvidence}”这两个事实。把它们拆成“为什么先跑通、卡点在哪、普通人怎么借势”的方法论，才会比泛资讯更有传播和收藏价值。`;
  }

  return `这篇最适合被翻成内容的点是“${evidence}”，因为它能直接拆成操作建议。我不会重复新闻，而会围绕“${secondEvidence}”去讲适合谁用、怎么落地、哪里会踩坑，这才是创作者视角真正有价值的信息增量。`;
}

function buildRiskComment(
  theme: InsightTheme,
  subject: string,
  evidence: string,
  secondEvidence: string,
) {
  if (theme === "media") {
    return `风险点不在热度，而在“${evidence}”和“${secondEvidence}”背后那套质量控制是否真的收得住。只要版权、品控或一致性还靠人工补救，${subject} 一旦放大规模，问题通常会比效率收益更早暴露。`;
  }

  return `这篇里我最警惕的是“${evidence}”被当成确定性能力去讲，但“${secondEvidence}”没有把限制条件说透。只要失败边界、权限要求或额外成本没被交代清楚，就该默认 ${subject} 的真实可用性被高估了。`;
}

function clip(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}...`;
}
