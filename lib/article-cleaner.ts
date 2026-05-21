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
];

const TAIL_NOISE_TEXT_MARKERS = [
  "相关阅读",
  "推荐阅读",
  "关于量子位",
  "热门文章",
  "扫码分享至朋友圈",
  "版权所有，未经授权",
  "加入我们",
  "商务合作",
  "评论 feed",
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

    for (const image of extractImageBlocksFromHtml(fragment, pageUrl)) {
      const normalizedUrl = image.url.replace(/^http:\/\//i, "https://");
      if (seenImages.has(normalizedUrl)) continue;
      seenImages.add(normalizedUrl);
      contentBlocks.push(image);
    }

    const text = extractReadableTextFromHtmlBlock(fragment);
    if (!text) continue;
    if (cleanTitle && (text === cleanTitle || text.startsWith(cleanTitle))) continue;
    if (isLikelyInlineNoise(text, cleanTitle)) continue;
    if (seenParagraphs.has(text)) continue;
    seenParagraphs.add(text);
    contentBlocks.push({
      type: "paragraph",
      text,
    });
  }

  return trimLeadingNoiseBlocks(contentBlocks, cleanTitle);
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
    .filter(Boolean);

  while (paragraphs.length > 0 && isLeadingNoise(paragraphs[0], cleanTitle)) {
    paragraphs.shift();
  }

  return paragraphs.join("\n\n").trim();
}

function isLeadingNoise(paragraph: string, cleanTitle: string) {
  if (cleanTitle && paragraph.includes(cleanTitle)) return true;
  if (LEADING_NOISE_EXACT.has(paragraph)) return true;
  if (LEADING_NOISE_REGEXES.some((regex) => regex.test(paragraph))) return true;

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

function trimLeadingNoiseBlocks(blocks: ArticleContentBlock[], cleanTitle: string) {
  const result = [...blocks];

  while (result[0]?.type === "paragraph" && isLeadingNoise(result[0].text, cleanTitle)) {
    result.shift();
  }

  return result;
}

function isLikelyInlineNoise(text: string, cleanTitle: string) {
  if (!text) return true;
  if (LEADING_NOISE_EXACT.has(text)) return true;
  if (LEADING_NOISE_REGEXES.some((regex) => regex.test(text))) return true;
  if (cleanTitle && text.includes(cleanTitle) && text.length <= cleanTitle.length + 12) return true;
  return false;
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

  return html;
}

function extractArticleHtmlBlock(html: string, pageUrl?: string) {
  const articleMatch =
    html.match(/<article[\s\S]*?<\/article>/i) ??
    html.match(/<main[\s\S]*?<\/main>/i) ??
    html.match(/<body[\s\S]*?<\/body>/i);

  return trimHtmlTailBySite(articleMatch?.[0] ?? html, pageUrl);
}

function cutAtFirstMarker(content: string, markers: string[]) {
  const cutIndex = markers
    .map((marker) => content.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (typeof cutIndex !== "number") return content;
  return content.slice(0, cutIndex);
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
