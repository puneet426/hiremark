"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Moon, Sun } from "lucide-react";
import React from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Logo({ size = "md", href = "/" }: { size?: "sm" | "md" | "lg"; href?: string | null }) {
  const s = { sm: "text-[18px]", md: "text-[20px]", lg: "text-[28px]" }[size];
  // the mark: a cut H in the accent that starts the word, so it reads "Hiremark"
  const inner = (
    <span className={cx("hm-logo text-fg", s)} aria-label="Hiremark" role="img">
      <svg viewBox="0 0 28 32" aria-hidden focusable="false"><path d="M2 7.5 9.5 2v28H2z" /><path d="M18.5 2H26v22.5L18.5 30z" /><path d="M11 18.2l6-5.4v5.6l-6 5.4z" className="h-bar" /></svg>
      <span aria-hidden>iremark</span>
    </span>
  );
  return href ? <Link href={href} aria-label="Hiremark home">{inner}</Link> : inner;
}

/** A round back button: the previous page when the visitor came from this site, else `fallback`. */
export function BackButton({ fallback = "/", className }: { fallback?: string; className?: string }) {
  const router = useRouter();
  const back = () => {
    const sameSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (sameSite && history.length > 1) router.back();
    else router.push(fallback);
  };
  return (
    <button type="button" onClick={back} aria-label="Go back" title="Go back"
      className={cx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-panel text-fg transition-[background-color,border-color,transform] duration-200 hover:-translate-x-0.5 hover:border-accent hover:bg-accent-dim active:scale-95", className)}>
      <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </button>
  );
}

/** Light and dark theme switch. The choice is saved under the same key the home page uses. */
export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean | null>(null);
  React.useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  const flip = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("hm-theme", next); } catch {}
    setDark(next === "dark");
  };
  return (
    <button type="button" onClick={flip} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Switch theme"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong text-fg transition-colors hover:bg-raised active:scale-95">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

type BtnProps =React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "lg"; busy?: boolean };
const btnBase = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap select-none";
const btnVariant = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-[0_6px_20px_-8px_var(--accent)]",
  secondary: "border border-line-strong bg-panel text-fg hover:bg-raised hover:border-faint",
  ghost: "text-muted hover:text-fg hover:bg-raised",
  danger: "border border-bad/50 text-bad hover:bg-bad/10",
};
const btnSize = { sm: "h-9 px-4 text-[13px]", md: "h-11 px-5 text-sm", lg: "h-12 px-6 text-[15px]" };

export function Button({ variant = "primary", size = "md", busy, className, children, ...rest }: BtnProps) {
  return (
    <button className={cx(btnBase, btnVariant[variant], btnSize[size], className)} disabled={busy || rest.disabled} {...rest}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = "primary", size = "md", className, children }: { href: string; variant?: BtnProps["variant"]; size?: BtnProps["size"]; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={cx(btnBase, btnVariant[variant!], btnSize[size!], className)}>{children}</Link>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] text-muted">
        <span>{label}</span>
        {hint && <span className="text-faint">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[13px] text-bad">{error}</span>}
    </label>
  );
}

export const inputCls = "h-11 w-full rounded-xl border border-line-strong bg-panel px-3.5 text-sm text-fg placeholder:text-faint transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-dim)] focus:outline-none";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cx(inputCls, className)} {...p} />;
});
export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(inputCls, "appearance-none pr-8", className)} {...p} />;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "bad" | "good" | "warn"; children: React.ReactNode }) {
  const t = { info: "border-accent/30 bg-accent-dim text-fg", bad: "border-bad/40 text-bad bg-bad/5", good: "border-good/40 text-good bg-good/5", warn: "border-warn/40 text-warn bg-warn/5" }[tone];
  return <div role={tone === "bad" ? "alert" : "status"} className={cx("rounded-xl border px-3.5 py-2.5 text-sm", t)}>{children}</div>;
}

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cx("rounded-2xl border border-line bg-panel shadow-[var(--shadow)]", className)}>{children}</section>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx("text-[13px] font-medium text-accent", className)}>{children}</p>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-16 text-sm text-faint" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

const verdictTone: Record<string, string> = { "Strong hire": "text-good", Hire: "text-good", "Lean no hire": "text-warn", "No hire": "text-bad", "Ended early": "text-bad" };
export function Stamp({ verdict, animate, size = "md" }: { verdict: string; animate?: boolean; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "text-[10px] !px-2 !py-[3px] !border", md: "text-xs", lg: "text-lg !px-5 !py-2 !border-[3px]" }[size];
  return <span className={cx("stamp", s, verdictTone[verdict] || "text-muted", animate && "stamp-in")}>{verdict}</span>;
}
export const verdictColor = (v: string) => verdictTone[v] || "text-muted";

export function Bar({ value, tone = "fg" }: { value: number; tone?: "fg" | "mark" | "good" | "warn" | "bad" }) {
  const c = { fg: "bg-accent", mark: "bg-mark", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className={cx("h-full rounded-full transition-[width] duration-700", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export const scoreTone = (v: number) => (v >= 70 ? "good" : v >= 55 ? "warn" : "bad") as "good" | "warn" | "bad";
