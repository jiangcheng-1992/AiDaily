export type DouyinVideoSource = {
  id: string;
  name: string;
  secUserId: string;
  profileUrl: string;
  tags: string[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
  autoIngest: boolean;
};

export const douyinVideoSources: DouyinVideoSource[] = [
  {
    id: "douyin-qbitai",
    name: "抖音 · 量子位",
    secUserId: "MS4wLjABAAAA1bL6-89P1h_ODlkg17TXKneHuPfHijf8ogsmg6gPVAQ",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAA1bL6-89P1h_ODlkg17TXKneHuPfHijf8ogsmg6gPVAQ",
    tags: ["抖音", "量子位", "AI视频", "热点解读"],
    autoIngest: true,
  },
  {
    id: "douyin-ai-tech-review",
    name: "抖音 · AI科技评论",
    secUserId: "MS4wLjABAAAAsB43-GIzNgYD1NMc3w4xU2dzg3N0mJpoeDKoxQxUNbCZmC--JIDGfITLcYFJm3GR",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAsB43-GIzNgYD1NMc3w4xU2dzg3N0mJpoeDKoxQxUNbCZmC--JIDGfITLcYFJm3GR",
    tags: ["抖音", "AI科技评论", "AI视频", "产业解读"],
    autoIngest: true,
  },
  {
    id: "douyin-geekpark",
    name: "抖音 · 极客公园",
    secUserId: "MS4wLjABAAAAUSlqiKKHF4YY41ZUbYO3c75QRqsgNIO8BGjMNypvfF4",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAUSlqiKKHF4YY41ZUbYO3c75QRqsgNIO8BGjMNypvfF4",
    tags: ["抖音", "极客公园", "AI视频", "产品趋势"],
    includeKeywords: ["ai", "人工智能", "大模型", "agent", "机器人", "aigc", "智能体"],
    autoIngest: true,
  },
  {
    id: "douyin-36kr",
    name: "抖音 · 36氪",
    secUserId: "MS4wLjABAAAAVlVXeG5jSANae673ZqtesxdJnMXcffIRYggdheHgyNA",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAVlVXeG5jSANae673ZqtesxdJnMXcffIRYggdheHgyNA",
    tags: ["抖音", "36氪", "AI视频", "商业观察"],
    includeKeywords: ["ai", "人工智能", "大模型", "agent", "aigc", "机器人", "智能体"],
    excludeKeywords: ["汽车", "餐饮", "楼市", "旅游", "消费券"],
    autoIngest: true,
  },
  {
    id: "douyin-machine-heart",
    name: "抖音 · 机器之心",
    secUserId: "MS4wLjABAAAAlTYtD0SMDufbD3_PKktRxr0wBypek0Eul8WLbprOJ9I",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAlTYtD0SMDufbD3_PKktRxr0wBypek0Eul8WLbprOJ9I",
    tags: ["抖音", "机器之心", "AI视频", "论文解读"],
    autoIngest: true,
  },
  {
    id: "douyin-xinzhiyuan",
    name: "抖音 · 新智元",
    secUserId: "MS4wLjABAAAA-t8K7nJoh9vDraSyRuuevdnlJ-i5VeGh_ST5jcfnLa3cCAhy9d6YfQp9dgCugNRw",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAA-t8K7nJoh9vDraSyRuuevdnlJ-i5VeGh_ST5jcfnLa3cCAhy9d6YfQp9dgCugNRw",
    tags: ["抖音", "新智元", "AI视频", "热点解读"],
    autoIngest: true,
  },
  {
    id: "douyin-jiazi",
    name: "抖音 · 甲子光年",
    secUserId: "MS4wLjABAAAAoB-CX64l3bXekoZkbFrJ2RkE1zJUTgnNQg8loOimhLk",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAoB-CX64l3bXekoZkbFrJ2RkE1zJUTgnNQg8loOimhLk",
    tags: ["抖音", "甲子光年", "AI视频", "产业趋势"],
    includeKeywords: ["ai", "人工智能", "大模型", "智能体", "机器人", "算力"],
    autoIngest: true,
  },
  {
    id: "douyin-shuishan-ai",
    name: "抖音 · 水山AI漫谈",
    secUserId: "MS4wLjABAAAA__vAcnwb0Z6hhTeDX4PTS1NmC0i2yGw3ZBkDgpV0_ieQfC2hZLSut37PJldJcRl5",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAA__vAcnwb0Z6hhTeDX4PTS1NmC0i2yGw3ZBkDgpV0_ieQfC2hZLSut37PJldJcRl5",
    tags: ["抖音", "水山AI漫谈", "AI视频", "模型评测"],
    includeKeywords: ["ai", "人工智能", "大模型", "grok", "openai", "deepseek", "模型"],
    autoIngest: true,
  },
  {
    id: "douyin-laozhang-ai",
    name: "抖音 · 程序员老张AI教学",
    secUserId: "MS4wLjABAAAAC0evg_i3pA3fgPZmmj1P3rUGa_HObr2058eo1UsmKbE",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAC0evg_i3pA3fgPZmmj1P3rUGa_HObr2058eo1UsmKbE",
    tags: ["抖音", "程序员老张", "AI视频", "AI教学"],
    includeKeywords: ["ai", "人工智能", "chatgpt", "gpt", "大模型", "工具", "应用"],
    autoIngest: true,
  },
  {
    id: "douyin-aigc-kaige",
    name: "抖音 · AIGC凯哥",
    secUserId: "MS4wLjABAAAAdd7-PwG8yAJZGx9Qt4VSDolGfODPBrdH1K34Us-73AFeLcL5mxiBz4ZhKDnzSs56",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAdd7-PwG8yAJZGx9Qt4VSDolGfODPBrdH1K34Us-73AFeLcL5mxiBz4ZhKDnzSs56",
    tags: ["抖音", "AIGC凯哥", "AI视频", "工具实操"],
    includeKeywords: ["ai", "aigc", "grok", "deepseek", "chatgpt", "大模型", "工具"],
    autoIngest: true,
  },
  {
    id: "douyin-wanjuan-agi",
    name: "抖音 · 万卷AGI",
    secUserId: "MS4wLjABAAAAdwrOTCnjSeYuc5ks3fdBVTbygL8hKfeoiurGkQT1Z6A",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAdwrOTCnjSeYuc5ks3fdBVTbygL8hKfeoiurGkQT1Z6A",
    tags: ["抖音", "万卷AGI", "AI视频", "AGI观察"],
    includeKeywords: ["ai", "agi", "人工智能", "grok", "deepseek", "大模型", "图像生成"],
    autoIngest: true,
  },
  {
    id: "douyin-qige-ai",
    name: "抖音 · 七哥的AI日常",
    secUserId: "MS4wLjABAAAAdWWZURTu0UU7-i9nOvap2xxKVJFpKJKIu1hxiFKzdjzQzq3YZsp2zokwjXWPZm5X",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAdWWZURTu0UU7-i9nOvap2xxKVJFpKJKIu1hxiFKzdjzQzq3YZsp2zokwjXWPZm5X",
    tags: ["抖音", "七哥的AI日常", "AI视频", "AI应用"],
    includeKeywords: ["ai", "人工智能", "grok", "deepseek", "大模型", "应用", "开发"],
    autoIngest: true,
  },
  {
    id: "douyin-manong-ai",
    name: "抖音 · 码农说AI",
    secUserId: "MS4wLjABAAAAWV0DztKBY3E1emmPb50qLP5iuPl9gKud3Chk3abfy3uSqNro9RPzZSmMH8UF4CWU",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAWV0DztKBY3E1emmPb50qLP5iuPl9gKud3Chk3abfy3uSqNro9RPzZSmMH8UF4CWU",
    tags: ["抖音", "码农说AI", "AI视频", "开发者视角"],
    includeKeywords: ["ai", "人工智能", "deepseek", "grok", "大模型", "国产ai", "编程"],
    autoIngest: true,
  },
  {
    id: "douyin-kouzhaoge-research",
    name: "抖音 · 口罩哥研报60秒",
    secUserId: "MS4wLjABAAAAnKeRN8QUgooS1pPRqOf_N_jnuztzUyocl0_vUndQFJs",
    profileUrl:
      "https://www.douyin.com/user/MS4wLjABAAAAnKeRN8QUgooS1pPRqOf_N_jnuztzUyocl0_vUndQFJs",
    tags: ["抖音", "口罩哥研报60秒", "AI视频", "研报解读"],
    includeKeywords: ["ai", "人工智能", "deepseek", "grok", "论文", "大模型", "研报"],
    autoIngest: true,
  },
];

export const autoIngestDouyinVideoSources = douyinVideoSources.filter(
  (source) => source.autoIngest,
);

export const autoIngestDouyinSourceIds = new Set(
  autoIngestDouyinVideoSources.map((source) => source.id),
);
