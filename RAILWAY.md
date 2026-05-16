# AI圈 Railway 部署说明

## Web 服务

Railway 会读取 `railway.toml`：

- 构建命令：`npm run build`
- 启动命令：`npm start`
- 健康检查：`/api/health`

项目使用 Next.js standalone 输出，构建后会把 `.next/static` 和 `public` 复制到 `.next/standalone`，正式环境启动更轻。

## 环境变量

在 Railway Web 服务里配置：

```bash
APP_BASE_URL=https://你的服务域名
CRON_SECRET=换成一段足够长的随机字符串
OPENAI_API_KEY=可选，填写后启用正式 AI 评论
AI_COMMENT_MODEL=gpt-4.1-mini
SOURCE_FETCH_LIMIT=12
SOURCE_ITEMS_PER_SOURCE=6
AIQ_USER_AGENT=AIQ/1.0 (+https://github.com/jiangcheng-1992/-AIDaily)
```

`CRON_SECRET` 在生产环境必填，用于保护 `/api/cron/ingest`。

## 定时抓取服务

第一版还没有接数据库，所以 `/api/cron/ingest` 当前是 dry run：会抓取并标准化候选内容，但不入库。

后续在 Railway 新增一个 Scheduled/Cron 服务，复用同一个仓库，启动命令设置为：

```bash
npm run ingest:sources
```

这个服务也需要配置：

```bash
APP_BASE_URL=https://你的 Web 服务域名
CRON_SECRET=和 Web 服务保持一致
SOURCE_FETCH_LIMIT=12
SOURCE_ITEMS_PER_SOURCE=6
```

建议先设为每天 08:00 执行一次，接入数据库和去重逻辑后再提高频率。

## 本地检查

```bash
npm run typecheck
npm run lint
npm run build
```
