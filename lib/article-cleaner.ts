import type { ArticleContentBlock } from "@/lib/mock-data";

const LEADING_NOISE_EXACT = new Set([
  "首页",
  "资讯",
  "智能车",
  "智库",
  "活动",
  "MEET大会",
  "AIGC",
  "听闻",
  "返回顶部",
  "举报",
  "企业号",
  "企服点评",
  "企业服务",
  "核心服务",
  "创投平台",
  "AI测评网",
  "快讯",
  "资讯, 推荐",
  "财经",
  "自助报道",
  "城市",
  "最新",
  "-->",
]);

const LEADING_NOISE_REGEXES = [
  /^来源[：:]/,
  /^作者[｜|:：]/,
  /^编辑[｜|:：]/,
  /^图源[：:]/,
  /^本文图片来自/,
  /^量子位\s*[|｜]/,
  /^\S{1,12}\s+投稿$/,
  /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}(日)?$/,
  /^\d{1,2}:\d{2}(:\d{2})?$/,
  /^[A-Za-z0-9_]+$/,
];

const STRUCTURAL_NOISE_REGEXES = [
  /^(36氪|36Kr|36KR)(Auto|出海|研究院|企服点评|财经|职场|未来消费|智能涌现|城市|创投|暗涌|硬氪|媒体品牌|\s|·|\/|[A-Za-z])+$/i,
  /^(创投发布|寻找报道|核心服务|企业号|企业服务|创投平台|AI测评网|快讯|资讯[,，、\s]推荐|财经|自助报道|城市|最新)(\s|$)/,
  /^(LP源计划|VClub|VClub投资机构库|投资机构职位推介|投资人认证|投资人服务)(\s|$)/i,
  /^(关于36氪|加入我们|商务合作|友情链接|用户协议|隐私政策|违法和不良信息|未成年人保护|京ICP备|京公网安备)/,
  /^本站由\s*阿里云.*提供计算与安全服务/,
  /^©\s*20\d{2}/,
];

const TAIL_NOISE_MARKERS = [
  "\n本文由",
  "\n评论区",
  "\n你可能也喜欢这些文章",
  "\n打开微信“扫一扫”",
  "\n返回顶部",
  "\n关于36氪",
  "\n下一篇",
  "\n寻求报道",
  "\n量子位 QbitAI",
  "\n扫码关注量子位",
  "\n量子位报道",
  "\n本文链接：",
  "\n论文链接：",
  "\n代码仓库：",
  "\n版权所有，未经授权",
  "\n扫码分享至朋友圈",
  "\n### 相关阅读",
  "\n相关阅读",
  "\n热门文章",
  "\n搜索：",
  "\n关于量子位",
  "\n加入我们",
  "\n关于36氪",
  "\n企业号",
  "\n核心服务",
  "\n创投平台",
  "\n自助报道",
  "\n违法和不良信息",
  "\n广告声明",
  "\n相关文章",
  "\n软媒旗下网站",
  "\n软媒旗下软件",
];

const TAIL_NOISE_TEXT_MARKERS = [
  "相关阅读",
  "相关文章",
  "推荐阅读",
  "关于量子位",
  "热门文章",
  "扫码分享至朋友圈",
  "版权所有，未经授权",
  "加入我们",
  "商务合作",
  "评论 feed",
  "广告声明",
  "软媒旗下网站",
  "软媒旗下软件",
  "IT之家所有文章均包含本声明",
];

export function cleanTitleText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s*&\s*#0*38;?/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtmlToText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticleText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function extractArticleTextFromHtml(
  html: string,
  preferredTitle = "",
  pageUrl?: string,
) {
  const block = extractArticleHtmlBlock(html, pageUrl);

  const normalized = normalizeArticleText(
    block
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n"),
  );

  return focusArticleText(normalized, preferredTitle);
}

export function extractArticleBlocksFromHtml(
  html: string,
  preferredTitle = "",
  pageUrl?: string,
): ArticleContentBlock[] {
  const block = extractArticleHtmlBlock(html, pageUrl);
  const segments = Array.from(
    block.matchAll(
      /<(figure|p|h2|h3|h4|blockquote|li)\b[\s\S]*?<\/\1>|<img\b[^>]*\/?>/gi,
    ),
  );
  const contentBlocks: ArticleContentBlock[] = [];
  const seenImages = new Set<string>();
  const seenParagraphs = new Set<string>();
  const cleanTitle = cleanTitleText(preferredTitle).replace(/[-|｜]\s*\S+.*$/i, "").trim();

  for (const segment of segments) {
    const fragment = segment[0];
    const text = extractReadableTextFromHtmlBlock(fragment);
    if (isLikelyInlineNoise(text, cleanTitle)) continue;

    for (const image of extractImageBlocksFromHtml(fragment, pageUrl)) {
      const normalizedUrl = image.url.replace(/^http:\/\//i, "https://");
      if (seenImages.has(normalizedUrl)) continue;
      seenImages.add(normalizedUrl);
      contentBlocks.push(image);
    }

    if (!text) continue;
    if (cleanTitle && (text === cleanTitle || text.startsWith(cleanTitle))) continue;
    if (seenParagraphs.has(text)) continue;
    seenParagraphs.add(text);
    contentBlocks.push({
      type: "paragraph",
      text,
    });
  }

  return trimBoundaryNoiseBlocks(contentBlocks, cleanTitle);
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => safeCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      safeCodePoint(Number.parseInt(code, 16)),
    );
}

export function countTailNoiseIndicators(value: string) {
  return TAIL_NOISE_TEXT_MARKERS.reduce((count, marker) => {
    return count + (value.includes(marker) ? 1 : 0);
  }, 0);
}

function focusArticleText(content: string, preferredTitle: string) {
  let result = content;
  const cleanTitle = cleanTitleText(preferredTitle).replace(/[-|｜]\s*\S+.*$/i, "").trim();

  if (cleanTitle) {
    const titleIndex = result.indexOf(cleanTitle);
    if (titleIndex >= 0) {
      result = result.slice(titleIndex);
    }
  }

  const cutIndex = TAIL_NOISE_MARKERS
    .map((marker) => result.indexOf(marker))
    .filter((index) => index > 120)
    .sort((left, right) => left - right)[0];

  if (typeof cutIndex === "number") {
    result = result.slice(0, cutIndex);
  }

  const paragraphs = result
    .split(/\n{2,}|\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => !isLikelyInlineNoise(paragraph, cleanTitle));

  while (paragraphs.length > 0 && isLeadingNoise(paragraphs[0], cleanTitle)) {
    paragraphs.shift();
  }

  while (
    paragraphs.length > 0 &&
    isLikelyTailNoise(paragraphs[paragraphs.length - 1], cleanTitle)
  ) {
    paragraphs.pop();
  }

  return paragraphs.join("\n\n").trim();
}

function isLeadingNoise(paragraph: string, cleanTitle: string) {
  if (cleanTitle && paragraph.includes(cleanTitle)) return true;
  if (LEADING_NOISE_EXACT.has(paragraph)) return true;
  if (LEADING_NOISE_REGEXES.some((regex) => regex.test(paragraph))) return true;
  if (STRUCTURAL_NOISE_REGEXES.some((regex) => regex.test(paragraph))) return true;

  const shortLine = paragraph.length <= 18 && !/[。！？!?]/.test(paragraph);
  if (shortLine) return true;

  return false;
}

function safeCodePoint(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";

  try {
    return String.fromCodePoint(value);
  } catch {
    return "";
  }
}

function extractImageBlocksFromHtml(
  fragment: string,
  pageUrl?: string,
): Array<Extract<ArticleContentBlock, { type: "image" }>> {
  const matches = Array.from(fragment.matchAll(/<img\b[^>]*>/gi));
  const images: Array<Extract<ArticleContentBlock, { type: "image" }>> = [];

  for (const match of matches) {
    const tag = match[0];
    const src =
      readTagAttribute(tag, "data-src") ||
      readTagAttribute(tag, "data-original") ||
      readTagAttribute(tag, "src");
    const url = absolutizeUrl(decodeHtmlEntities(src), pageUrl);
    if (!isUsableArticleImage(url)) continue;

    const alt = cleanTitleText(readTagAttribute(tag, "alt"));
    images.push({
      type: "image",
      url,
      alt: alt || undefined,
    });
  }

  return images;
}

function extractReadableTextFromHtmlBlock(fragment: string) {
  return normalizeArticleText(
    fragment
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<figcaption[^>]*>/gi, "\n")
      .replace(/<\/figcaption>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n"),
  );
}

function trimBoundaryNoiseBlocks(blocks: ArticleContentBlock[], cleanTitle: string) {
  const result = blocks.filter((block) => {
    if (block.type !== "paragraph") return true;
    return !isLikelyInlineNoise(block.text, cleanTitle);
  });

  while (result[0]?.type === "paragraph" && isLeadingNoise(result[0].text, cleanTitle)) {
    result.shift();
  }

  while (true) {
    const lastBlock = result[result.length - 1];
    if (lastBlock?.type !== "paragraph") break;
    if (!isLikelyTailNoise(lastBlock.text, cleanTitle)) break;
    result.pop();
  }

  return result;
}

function isLikelyInlineNoise(text: string, cleanTitle: string) {
  if (!text) return true;
  if (LEADING_NOISE_EXACT.has(text)) return true;
  if (LEADING_NOISE_REGEXES.some((regex) => regex.test(text))) return true;
  if (STRUCTURAL_NOISE_REGEXES.some((regex) => regex.test(text))) return true;
  if (cleanTitle && text.includes(cleanTitle) && text.length <= cleanTitle.length + 12) return true;
  return false;
}

function isLikelyTailNoise(text: string, cleanTitle: string) {
  if (isLikelyInlineNoise(text, cleanTitle)) return true;
  return TAIL_NOISE_TEXT_MARKERS.some((marker) => text.includes(marker));
}

function trimHtmlTailBySite(html: string, pageUrl?: string) {
  if (!pageUrl) return html;

  const hostname = getHostname(pageUrl);
  if (!hostname) return html;

  if (hostname.endsWith("qbitai.com")) {
    return cutAtFirstMarker(html, [
      "<!--版权声明-->",
      "<!--相关阅读 start-->",
      "<div class=\"xiangguan\">",
      "<h3>相关阅读</h3>",
      "<!--热门文章 end-->",
      "<div class=\"footer\">",
    ]);
  }

  if (hostname.endsWith("36kr.com")) {
    return cutAtFirstMarker(html, [
      "<footer",
      "关于36氪",
      "本站由阿里云",
      "违法和不良信息",
      "相关推荐",
      "推荐阅读",
      "热门文章",
    ]);
  }

  if (hostname.endsWith("ithome.com")) {
    return cutAtFirstMarker(html, [
      "广告声明",
      "相关文章",
      "软媒旗下网站",
      "软媒旗下软件",
      "IT之家所有文章均包含本声明",
      "结果仅供参考",
    ]);
  }

  return html;
}

function extractArticleHtmlBlock(html: string, pageUrl?: string) {
  const preparedHtml = stripStructuralHtml(html);
  const siteBlock = extractSiteArticleHtmlBlock(preparedHtml, pageUrl);
  if (siteBlock) return trimHtmlTailBySite(siteBlock, pageUrl);

  const articleMatch =
    preparedHtml.match(/<article[\s\S]*?<\/article>/i) ??
    preparedHtml.match(/<main[\s\S]*?<\/main>/i) ??
    preparedHtml.match(/<body[\s\S]*?<\/body>/i);

  return trimHtmlTailBySite(articleMatch?.[0] ?? preparedHtml, pageUrl);
}

function extractSiteArticleHtmlBlock(html: string, pageUrl?: string) {
  const hostname = pageUrl ? getHostname(pageUrl) : "";

  if (hostname.endsWith("36kr.com")) {
    return extractAroundClassKeyword(html, [
      "articleDetailContent",
      "article-content",
      "articleContent",
      "kr-rich-text",
      "rich-text",
      "detail-content",
      "article-main",
    ]);
  }

  return extractAroundClassKeyword(html, [
    "article-content",
    "post_content",
    "post-content",
    "news-content",
    "entry-content",
    "rich-text",
    "content-body",
  ]);
}

function extractAroundClassKeyword(html: string, keywords: string[]) {
  const keywordPattern = keywords.map(escapeRegExp).join("|");
  const match = html.match(
    new RegExp(
      `<([a-z][\\w:-]*)[^>]+(?:class|id)=["'][^"']*(?:${keywordPattern})[^"']*["'][^>]*>`,
      "i",
    ),
  );

  if (!match || match.index === undefined) return "";

  const fromStart = html.slice(match.index);
  return cutAtFirstMarker(fromStart, [
    "<aside",
    "<footer",
    "相关推荐",
    "相关文章",
    "推荐阅读",
    "热门文章",
    "广告声明",
    "软媒旗下网站",
    "软媒旗下软件",
    "关于36氪",
    "本站由阿里云",
    "违法和不良信息",
  ]);
}

function stripStructuralHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
}

function cutAtFirstMarker(content: string, markers: string[]) {
  const cutIndex = markers
    .map((marker) => content.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (typeof cutIndex !== "number") return content;
  return content.slice(0, cutIndex);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function readTagAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function absolutizeUrl(value: string | undefined, pageUrl?: string) {
  if (!value) return "";
  if (!pageUrl) return value;

  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

function isUsableArticleImage(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.toLowerCase();
  if (/^(data:|blob:)/i.test(value)) return false;
  if (/\.(svg|gif)(\?|#|$)/i.test(value)) return false;
  if (/staticx\.36krcdn\.com\/36kr-web\/static\//i.test(normalized)) return false;
  if (/\/36kr-web\/static\//i.test(normalized)) return false;
  if (
    /(avatar|logo|icon|sprite|wechat|qrcode|qr-code|barcode|placeholder|default|head\.jpg)/i.test(
      normalized,
    )
  ) {
    return false;
  }
  if (/(^|\/)\d{2,4}-\d{2,4}x\d{2,4}\.(jpe?g|png|webp)(\?|#|$)/i.test(normalized)) {
    return false;
  }
  if (/(^|\/)\d{2,4}x\d{2,4}\.(jpe?g|png|webp)(\?|#|$)/i.test(normalized)) {
    return false;
  }
  if (/(qbitai[-_]?logo|qbitai_icon|qrcode_qbitai)/i.test(normalized)) return false;
  if (
    /(logo_|logowhite|code_production|dailyplanet|jingzhun|krspace|aly\.|bytey\.|gaodi\.|getui\.|ftnn\.|renren@2x|lingke\.)/i.test(
      normalized,
    )
  ) {
    return false;
  }
  return /^https?:\/\//i.test(value) || value.startsWith("//") || value.startsWith("/");
}
