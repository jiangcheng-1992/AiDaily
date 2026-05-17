# AI圈 Railway 部署说明

## Web 服务

Railway 会读取 `railway.toml`：

- 构建命令：`npm run build`
- 启动命令：`npm start`
- 健康检查：`/api/health`

项目使用 Next.js standalone 输出，构建后会把 `.next/static` 和 `public` 复制到 `.next/standalone`，正式环境启动更轻。

`npm start` 会通过 `scripts/start-standalone.mjs` 启动服务，并把 Next.js standalone 的监听地址固定为 `0.0.0.0`，避免 Railway 健康检查因为容器 `HOSTNAME` 绑定失败。

## 环境变量

在 Railway Web 服务里配置：

```bash
APP_BASE_URL=https://你的服务域名
CRON_SECRET=换成一段足够长的随机字符串
OPENAI_API_KEY=可选，填写后启用正式 AI 评论
AI_COMMENT_MODEL=gpt-4.1-mini
SOURCE_FETCH_LIMIT=12
SOURCE_ITEMS_PER_SOURCE=6
GITHUB_SKILL_LIMIT=8
GENERATED_FEED_LIMIT=120
GITHUB_TOKEN=可选，建议填写 GitHub fine-grained token 提高 API 限额
AIQ_DATA_DIR=/data
HOSTNAME_BIND=0.0.0.0
AIQ_USER_AGENT=AIQ/1.0 (+https://github.com/jiangcheng-1992/AiDaily)
```

`CRON_SECRET` 在生产环境必填，用于保护 `/api/cron/ingest`。
`AIQ_DATA_DIR` 建议指向 Railway Volume 挂载目录，例如 `/data`，这样离线抓取的 `generated-feed.json` 不会因为服务重启丢失。

## 每小时定时抓取

当前抓取链路：

1. 抓取 AI RSS/Atom 权威信息源。
2. 调用 GitHub Search API 找热门 AI Skill 仓库。
3. 使用 GitHub stars 作为点赞基数，forks 作为收藏基数，热门 issue 作为真实讨论线索。
4. 为每条动态生成 AI 角色评论。
5. 写入服务端缓存文件 `generated-feed.json`。
6. 前端通过 `/api/feed` 自动读取新动态。

在 Railway 新增一个 Scheduled/Cron 服务，复用同一个仓库，启动命令设置为：

```bash
npm run ingest:sources
```

建议 cron 表达式设置为每小时一次：

```bash
0 * * * *
```

这个服务也需要配置：

```bash
APP_BASE_URL=https://你的 Web 服务域名
CRON_SECRET=和 Web 服务保持一致
SOURCE_FETCH_LIMIT=12
SOURCE_ITEMS_PER_SOURCE=6
GITHUB_SKILL_LIMIT=8
AIQ_DATA_DIR=/data
```

## 本地检查

```bash
npm run typecheck
npm run lint
npm run build
```

本地手动触发抓取：

```bash
$env:APP_BASE_URL="http://localhost:3004"
$env:CRON_SECRET="local-test"
npm run ingest:sources
```
