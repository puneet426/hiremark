"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArrowRight } from "lucide-react";
import { BackButton, Button, cx, LinkButton, Logo, Spinner, ThemeToggle } from "./ui";
import { Socials } from "./social";

export function PublicNav() {
  const { user } = useAuth();
  const path = usePathname();
  const home = user ? (user.role === "recruiter" ? "/recruiter" : user.role === "admin" ? "/admin" : "/app") : null;
  // the same links as the home page
  const links = [["/#report", "Product"], ["/recruiters", "Recruiters"], ["/pricing", "Pricing"], ["/#faq", "Questions"]];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
        <div className="flex items-center gap-3">
          {path !== "/" && <BackButton fallback="/" />}
          <Logo />
        </div>
        <nav className="hidden flex-1 items-center justify-center gap-1 text-sm md:flex" aria-label="Main">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={cx("rounded-full px-3.5 py-2 transition-colors", path === href ? "text-fg" : "text-muted hover:text-fg")}>
              <span className="ink-link pb-0.5">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <ThemeToggle />
          {home ? (
            <LinkButton href={home} size="sm">Open dashboard</LinkButton>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3 py-2 text-muted transition-colors hover:text-fg sm:block">Sign in</Link>
              <LinkButton href="/signup" size="sm">Take a free interview<ArrowRight className="h-3.5 w-3.5" /></LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** The same footer as the home page: a call to action, the links with the social marks, a wordmark. */
export function Footer() {
  const cols: [string, [string, string][]][] = [
    ["Product", [["/#report", "Report"], ["/#interview", "Interview"], ["/#rules", "Scoring"], ["/pricing", "Prices"]]],
    ["Students", [["/signup", "Sign up"], ["/login", "Sign in"], ["/leaderboard", "Leaderboard"]]],
    ["Recruiters", [["/recruiters", "Why Hiremark"], ["/signup?role=recruiter", "Recruiter account"], ["/pricing", "Plans"]]],
    ["Trust", [["/privacy", "Privacy"], ["/#faq", "Questions"]]],
  ];
  return (
    <footer className="on-black mt-auto overflow-hidden">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-7 border-b border-line py-16">
          <div>
            <h2 className="display max-w-[16ch] text-[40px] sm:text-[48px]">Sit your first interview this week</h2>
            <p className="mt-3 text-[17px] text-muted">Free, 40 minutes, the full report the same evening.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/signup">Take a free interview<ArrowRight className="h-4 w-4" /></LinkButton>
            <LinkButton href="/#report" variant="secondary">See a sample report</LinkButton>
          </div>
        </div>
        <div className="grid gap-10 py-14 md:grid-cols-[1.6fr_repeat(4,1fr)]">
          <div className="flex flex-col items-start gap-4">
            <Logo />
            <p className="max-w-[34ch] text-[15px] leading-relaxed text-muted">Mock interviews for SDE freshers, marked by code, for students outside the top ten campuses.</p>
            <Socials />
          </div>
          {cols.map(([title, items]) => (
            <div key={title}>
              <p className="text-[13px] font-medium text-muted">{title}</p>
              <ul className="mt-4 space-y-2.5 text-[15px]">{items.map(([href, label]) => <li key={label}><Link href={href} className="ink-link text-fg">{label}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <p className="foot-word mt-4" aria-hidden>Hiremark</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line py-6 text-[13px] text-muted">
          <span>© {new Date().getFullYear()} Hiremark</span>
          <span className="flex-1">Built for students outside the top ten campuses.</span>
          <Link href="/privacy" className="hover:text-fg">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}

const NAV = {
  student: [["/app", "Overview"], ["/app/resume", "Resume"], ["/app/book", "Interview"], ["/app/results", "Results"], ["/leaderboard", "Leaderboard"], ["/app/billing", "Billing"]],
  recruiter: [["/recruiter", "Candidates"], ["/recruiter/requests", "Contact requests"], ["/app/billing", "Plan"]],
  admin: [["/admin", "Admin"], ["/recruiter", "Candidates"], ["/leaderboard", "Leaderboard"]],
} as const;

/** Wraps signed-in pages: redirects visitors to sign in and shows the app navigation. */
export function AppShell({ children, role }: { children: React.ReactNode; role?: "student" | "recruiter" | "admin" | "any" }) {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login?next=" + encodeURIComponent(path));
    else if (role && role !== "any" && user.role !== role && user.role !== "admin") router.replace(user.role === "recruiter" ? "/recruiter" : "/app");
  }, [user, loading, role, router, path]);

  if (loading || !user) return <div className="mx-auto max-w-6xl px-5"><Spinner /></div>;
  const links = NAV[user.role];
  const logout = async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    router.replace("/");
  };
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          {path !== links[0][0] && <BackButton fallback={links[0][0]} />}
          <Logo size="sm" href={links[0][0]} />
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm" aria-label="App">
            {links.map(([href, label]) => {
              const active = href === "/app" || href === "/recruiter" ? path === href : path.startsWith(href);
              return (
                <Link key={href} href={href} className={cx("rounded-full px-3.5 py-1.5 whitespace-nowrap transition-colors", active ? "bg-accent text-accent-ink" : "text-muted hover:bg-raised hover:text-fg")}>{label}</Link>
              );
            })}
          </nav>
          <Link href="/app/profile" className="hidden text-sm text-muted hover:text-fg sm:block">{user.name}</Link>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10">{children}</main>
    </>
  );
}

export function PageTitle({ eyebrow, title, sub, right }: { eyebrow?: string; title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-2 text-[13px] font-medium text-accent">{eyebrow}</p>}
        <h1 className="display text-[36px] text-fg sm:text-[44px]">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
