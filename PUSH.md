# GitHub 推送说明

本项目的 Git 元数据目录是 `_git`，不要直接删除或重置它。

## 第一次或 token 失效后

在普通 PowerShell 窗口里运行：

```powershell
cd "C:\Users\Admin\Documents\trae_projects\ai圈"
npm run github:login
```

按提示完成 GitHub 登录。登录完成后，脚本会把当前仓库的 Git credential helper 指向 GitHub CLI。

## 推送当前 main

```powershell
cd "C:\Users\Admin\Documents\trae_projects\ai圈"
npm run push:main
```

这个命令会自动检查 GitHub 登录状态，然后执行：

```powershell
git --git-dir=_git --work-tree=. push -u origin main
```

## 常见问题

如果在 Codex 受限沙箱里运行，可能会看到 socket 被禁止访问的错误。这不是 Git 配置问题，而是当前代理环境禁止命令行访问外网。请在普通 PowerShell 窗口运行上面的命令。

如果 GitHub CLI 路径变化，可以先设置：

```powershell
$env:GH_PATH="C:\path\to\gh.exe"
npm run github:login
```
