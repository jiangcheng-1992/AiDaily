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
];

export const autoIngestDouyinVideoSources = douyinVideoSources.filter(
  (source) => source.autoIngest,
);

export const autoIngestDouyinSourceIds = new Set(
  autoIngestDouyinVideoSources.map((source) => source.id),
);
