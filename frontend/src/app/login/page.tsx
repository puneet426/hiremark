"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, User } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, Field, Input, Logo, Notice, BackButton, ThemeToggle } from "../../components/ui";

function safeNext(next: string | null, user: User) {
  // Only same-site paths are followed, so a crafted link cannot send people elsewhere.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return user.role === "recruiter" ? "/recruiter" : user.role === "admin" ? "/admin" : "/app";
}

function LoginForm() {
  const { setUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await api<{ user: User }>("/auth/login", { body: { email, password } });
      setUser(d.user);
      router.replace(safeNext(params.get("next"), d.user));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Notice tone="bad">{error}</Notice>}
      <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></Field>
      <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button type="submit" busy={busy} className="w-full">Sign in</Button>
    </form>
  );
}

export default function Login() {
  return (
    <main className="flex w-full flex-1 flex-col px-5 py-5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3"><BackButton fallback="/" /><Logo /></div>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
      <div className="rounded-3xl border border-line bg-panel p-7 shadow-[var(--shadow)] sm:p-10">
      <h1 className="display text-[40px]">Welcome back.</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Sign in to continue to your dashboard.</p>
      <Suspense><LoginForm /></Suspense>
      <p className="mt-6 text-sm text-muted">New here? <Link href="/signup" className="text-fg underline underline-offset-4">Create an account</Link></p>
      </div>
      </div>
    </main>
  );
}
