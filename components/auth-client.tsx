"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

export function AuthClient() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register({ name, email, password });
      } else {
        await login({ email, password });
      }

      router.push("/me");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
        <div className="rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 p-8 text-white shadow-lift">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-sm font-bold ring-1 ring-white/25">
            <Sparkles className="h-4 w-4" />
            加入 AI 圈
          </div>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-normal sm:text-5xl">
            保存灵感、管理投稿，把你的 AI 信息流同步起来
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-blue-50">
            注册后可以进入个人主页，查看收藏、投稿和评论数据。当前版本先保存在本地浏览器中，后续可平滑接入真实后端。
          </p>
        </div>

        <Card className="rounded-[2rem] p-5 shadow-lift">
          <div className="grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-black transition-colors",
                !isRegister ? "bg-white text-blue-700 shadow-soft" : "text-slate-500",
              )}
            >
              登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-black transition-colors",
                isRegister ? "bg-white text-blue-700 shadow-soft" : "text-slate-500",
              )}
            >
              注册
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister ? (
              <div className="space-y-2">
                <Label htmlFor="name">昵称</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="例如：AI 探索者"
                    className="pl-11"
                    autoComplete="name"
                  />
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="pl-11"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegister ? "至少 6 位" : "输入密码"}
                  className="pl-11"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            ) : null}

            <Button type="submit" variant="gradient" size="lg" className="w-full" disabled={loading}>
              {loading ? "处理中..." : isRegister ? "注册并登录" : "登录"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            这是本地演示账号系统，请不要使用常用真实密码。
          </p>
        </Card>
      </div>
    </div>
  );
}
