import type { Post } from "@/lib/mock-data";
import { generateMiniMaxText, hasMiniMaxTextAccess } from "@/lib/minimax-text";

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

type GeneratedPostCopy = {
  summary: string;
  content: string;
  whyItMatters: string;
  editorComment: string;
};

type GeneratedPostCopyPayload = {
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
}): GeneratedPostCopy {
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

export async function buildProductionPostCopy({
  title,
  rawContent,
  fallbackSummary,
  sourceName,
  tags = [],
}: {
  title: string;
  rawContent: string;
  fallbackSummary?: string;
  sourceName?: string;
  tags?: string[];
}): Promise<GeneratedPostCopy & { provider: "minimax" | "local" }> {
  const localCopy = buildGeneratedPostCopy({
    title,
    rawContent,
    fallbackSummary,
  });

  if (!hasMiniMaxTextAccess()) {
    return { provider: "local", ...localCopy };
  }

  try {
    const payload = await generateCopyWithMiniMax({
      title,
      cleanedContent: localCopy.content,
      fallbackSummary: localCopy.summary,
      sourceName,
      tags,
    });

    return {
      provider: "minimax",
      content: localCopy.content,
      summary: clip(payload.summary.trim(), 160) || localCopy.summary,
      whyItMatters: clip(payload.whyItMatters.trim(), 220) || localCopy.whyItMatters,
      editorComment: clip(payload.editorComment.trim(), 260) || localCopy.editorComment,
    };
  } catch (error) {
    console.warn("MiniMax post copy generation fell back to local insights", error);
    return { provider: "local", ...localCopy };
  }
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
  const variant = getCopyVariant(`${theme}:${subject}:${primary}`, 3);

  switch (theme) {
    case "media":
      return pickCopyVariant(variant, [
        `这不是普通内容生产新闻。关键在“${primary}”，它直接指向 AIGC 从单次演示走向批量生产；如果“${secondary}”也能接住分发和回收，内容团队的成本结构会被重写。`,
        `这条的看点在供给链，而不是热闹本身。“${primary}”说明 AI 已经进入素材、制作或发行环节；后续要看“${secondary}”能不能把效率优势变成稳定产出。`,
        `它把 AIGC 的问题从“能不能生成”推进到“能不能规模化交付”。如果“${primary}”背后的流程跑通，创作者和媒体团队都会重新计算人力、周期和品控。`,
      ]);
    case "agent":
      return pickCopyVariant(variant, [
        `这条最有价值的信号是“${primary}”：Agent 不再只是聊天入口，而是在接管具体步骤。下一步要看它是否能稳定完成任务、处理异常，并被真实团队重复使用。`,
        `重点不是又多了一个智能体概念，而是“${primary}”暴露了它正在替代哪段人工流程。如果“${secondary}”能持续复现，才说明它有机会进入工作流。`,
        `可以把这条当成 Agent 落地样本看。“${primary}”代表明确任务边界，真正的判断点是执行链路是否闭环，以及出错时有没有人机协同兜底。`,
      ]);
    case "model":
      return pickCopyVariant(variant, [
        `这条要看的不是模型名次，而是“${primary}”带来的实际能力变化。只要能力能落到产品体验、服务交付或多模态任务上，它才会从参数竞争变成应用机会。`,
        `模型新闻最容易变成排行榜叙事，但“${primary}”更像真实使用场景。后续如果能补上成本、延迟和稳定性，这条线就值得继续跟。`,
        `它的价值在于把模型能力拉回具体结果。“${primary}”如果不是一次性展示，而是可重复能力，开发者和产品团队才有理由重新设计功能边界。`,
      ]);
    case "research":
      return pickCopyVariant(variant, [
        `这条适合按验证线索来读。“${primary}”提供了一个可追踪指标，后续要看是否有公开 benchmark、复现条件和失败样本，否则很容易高估能力。`,
        `研究价值不在结论多漂亮，而在“${primary}”是否能被别人复现。只要评测口径清楚，这类成果才可能进入产品或工程栈。`,
        `它给出的关键线索是“${primary}”。如果“${secondary}”能继续补足实验边界和对比结果，这条就不只是论文动态，而是后续产品能力的前置信号。`,
      ]);
    case "robotics":
      return pickCopyVariant(variant, [
        `机器人方向最怕停在演示视频。“${primary}”更值得看，因为它涉及感知、控制或执行细节；如果稳定性和成本也跟上，才接近可交付系统。`,
        `这条把 AI 从屏幕带到物理世界。“${primary}”说明任务已经触达真实环境，下一步要盯连续执行、故障率和维护成本。`,
        `它的意义在于“${primary}”不只是模型输出，而是开始影响实体动作。商业化能不能走快，取决于“${secondary}”背后的可靠性。`,
      ]);
    case "infra":
      return pickCopyVariant(variant, [
        `基础设施新闻要看指标。“${primary}”如果能降低成本、延迟或部署复杂度，下游 AI 产品的可用边界会一起扩大。`,
        `这条的核心不是概念，而是“${primary}”有没有改变工程账本。只要吞吐、成本或稳定性改善，应用层很快会跟着受益。`,
        `它值得跟，是因为“${primary}”可能影响 AI 产品的底层约束。基础设施一旦变便宜或更好接入，很多原本不经济的场景会重新成立。`,
      ]);
    case "devtools":
      return pickCopyVariant(variant, [
        `开发者工具的判断标准很直接：“${primary}”有没有减少接入、调试或协作成本。如果答案是肯定的，它会比单纯模型升级更快进入团队日常。`,
        `这条的价值在工程入口。“${primary}”如果让复杂能力变得更容易复用，开发团队会更愿意把它纳入默认工作流。`,
        `它不是泛泛的“AI 编程”消息，关键是“${primary}”有没有缩短从想法到上线的距离。能省掉重复劳动的工具，才会形成粘性。`,
      ]);
    case "business":
      return pickCopyVariant(variant, [
        `商业侧要看投入产出。“${primary}”说明 AI 已经进入成本、定价或采购决策；如果后续有留存和付费数据，才算真正跑通。`,
        `这条不是单纯公司动态，而是在测试 AI 能不能改变业务账本。“${primary}”背后如果能带来更低成本或新增收入，就有持续跟踪价值。`,
        `它把 AI 讨论从技术效果拉到经营结果。“${primary}”如果能转化成采购、续费或效率提升，才说明市场真的愿意买单。`,
      ]);
    default:
      return pickCopyVariant(variant, [
        `这条的核心线索是“${primary}”。它比单纯趋势判断更具体，后续只要能继续出现可复现结果，就说明这不是短期噪音。`,
        `我会先看“${primary}”对应的真实场景，再看“${secondary}”有没有形成连续动作。能被复用、能降本或能带来新体验，才值得放进主线观察。`,
        `它值得保留在信息流里，是因为“${primary}”给出了一个可验证方向。后续如果缺少用户反馈、成本边界或落地案例，热度就需要降权。`,
      ]);
  }
}

function pickCopyVariant(optionsIndex: number, options: string[]) {
  return options[optionsIndex % options.length];
}

function getCopyVariant(seed: string, modulo: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % modulo;
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

async function generateCopyWithMiniMax({
  title,
  cleanedContent,
  fallbackSummary,
  sourceName,
  tags,
}: {
  title: string;
  cleanedContent: string;
  fallbackSummary: string;
  sourceName?: string;
  tags: string[];
}) {
  const text = await generateMiniMaxText({
    systemPrompt:
      "你是 AI 圈内容编辑。请根据给定文章信息生成中文 JSON，字段只允许有 summary、whyItMatters、editorComment。三段文案必须明显贴合文章事实，不能套话，不能复述标题，不能编造原文没有的外部信息。summary 用 1 到 2 句讲清核心事实；whyItMatters 解释这条内容为什么值得关注；editorComment 要像站长写的判断，给出更具体的价值、风险或后续观察点。只输出 JSON，不要额外说明。",
    userPrompt: JSON.stringify({
      task: "生成 AI 圈帖子文案",
      constraints: [
        "必须只基于提供的标题、正文、来源、标签来写，不能补外部资料。",
        "文案要点出原文里的具体动作、限制、数字、结果或场景，不能写成任何文章都适用的通用结论。",
        "summary 控制在 40 到 120 个中文字符。",
        "whyItMatters 控制在 70 到 170 个中文字符。",
        "editorComment 控制在 90 到 220 个中文字符。",
        "不要使用“值得关注”“引发关注”“说明了一切”等空泛表达开头。",
        "站长总结必须体现判断，不要只是换个说法重写正文。",
      ],
      article: {
        title,
        sourceName,
        tags,
        fallbackSummary,
        contentExcerpt: clip(cleanedContent, 5000),
      },
      outputShape: {
        summary: "一句到两句中文摘要",
        whyItMatters: "为什么重要",
        editorComment: "站长总结",
      },
    }),
    temperature: 0.25,
  });

  return parseGeneratedPostCopyPayload(text);
}

function parseGeneratedPostCopyPayload(value: string): GeneratedPostCopyPayload {
  const cleanValue = value
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleanValue) as GeneratedPostCopyPayload;
}
