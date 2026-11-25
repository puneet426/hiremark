"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { LinkButton, Logo, Notice, Spinner, BackButton, ThemeToggle } from "../../components/ui";

function Verify() {
  const token = useSearchParams().get("token") || "";
  const { refresh } = useAuth();
  const [state, setState] = useState<"busy" | "ok" | string>("busy");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api("/auth/verify", { body: { token } }).then(() => { setState("ok"); refresh(); }).catch((e) => setState(e.message));
  }, [token, refresh]);
  if (state === "busy") return <Spinner label="Confirming your email" />;
  return (
    <div className="space-y-6">
      {state === "ok" ? <Notice tone="good">Your email is confirmed.</Notice> : <Notice tone="bad">{state}</Notice>}
      <LinkButton href="/app">Go to your dashboard</LinkButton>
    </div>
  );
}

export default function Page() {
  return (
    <main className="flex w-full flex-1 flex-col px-5 py-5">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3"><BackButton fallback="/" /><Logo /></div>
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
      <div className="rounded-3xl border border-line bg-panel p-7 shadow-[var(--shadow)] sm:p-10">
      <h1 className="display mb-8 mt-10 text-[40px]">Email confirmation</h1>
      <Suspense><Verify /></Suspense>
      </div>
      </div>
    </main>
  );
}
