"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, User } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { Button, cx, Field, Input, Logo, Notice, BackButton, ThemeToggle } from "../../components/ui";

function SignupForm() {
  const { setUser } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<"student" | "recruiter">(params.get("role") === "recruiter" ? "recruiter" : "student");
  const [f, setF] = useState({ name: "", email: "", password: "", company: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password.length < 10) return setError("Use a password of at least 10 characters.");
    setBusy(true);
    setError("");
    try {
      const d = await api<{ user: User; dev_verify_url?: string }>("/auth/signup", { body: { ...f, role } });
      setUser(d.user);
      if (d.dev_verify_url) sessionStorage.setItem("hm_dev_verify", d.dev_verify_url);
      router.replace(role === "recruiter" ? "/recruiter" : "/app");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line-strong p-1" role="tablist" aria-label="Account type">
        {(["student", "recruiter"] as const).map((r) => (
          <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setRole(r)}
            className={cx("h-9 rounded-full text-sm transition-colors", role === r ? "bg-accent text-accent-ink" : "text-muted hover:text-fg")}>
            {r === "student" ? "I am a student" : "I am hiring"}
          </button>
        ))}
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <Field label="Full name"><Input required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={set("name")} /></Field>
      {role === "recruiter" && <Field label="Company"><Input required maxLength={120} autoComplete="organization" value={f.company} onChange={set("company")} /></Field>}
      <Field label={role === "recruiter" ? "Work email" : "Email"}><Input type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
      <Field label="Password" hint="At least 10 characters"><Input type="password" required minLength={10} maxLength={128} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
      <Button type="submit" busy={busy} className="w-full">Create account</Button>
      <p className="text-[13px] leading-relaxed text-faint">By creating an account you agree to how we handle your data, described on the <Link href="/privacy" className="underline underline-offset-4">privacy page</Link>.</p>
    </form>
  );
}

export default function Signup() {
  return (
    <main className="flex w-full flex-1 flex-col px-5 py-5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3"><BackButton fallback="/" /><Logo /></div>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
      <div className="rounded-3xl border border-line bg-panel p-7 shadow-[var(--shadow)] sm:p-10">
      <h1 className="display text-[40px]">Create your account.</h1>
      <p className="mb-8 mt-2 text-sm text-muted">Students get one full interview free.</p>
      <Suspense><SignupForm /></Suspense>
      <p className="mt-6 text-sm text-muted">Already registered? <Link href="/login" className="text-fg underline underline-offset-4">Sign in</Link></p>
      </div>
      </div>
    </main>
  );
}
