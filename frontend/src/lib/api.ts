// One place for every call to the backend. The CSRF token lives in memory only.
let csrf = "";

export function setCsrf(token: string) {
  csrf = token || "";
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function messageFrom(data: unknown, status: number): string {
  const d = data as { detail?: unknown } | null;
  if (d && typeof d.detail === "string") return d.detail;
  if (d && Array.isArray(d.detail) && d.detail[0]?.msg) return String(d.detail[0].msg).replace(/^Value error, /, "");
  if (status === 429) return "Too many requests. Please wait a moment.";
  return "Something went wrong. Please try again.";
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-csrf-token": csrf };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch("/api" + path, { method: opts.method || (body ? "POST" : "GET"), headers, body, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "You appear to be offline. Check your connection.");
  }
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, messageFrom(data, res.status));
  return data as T;
}

export type User = {
  id: string; email: string; name: string; role: "student" | "recruiter" | "admin"; email_verified: boolean;
  college: string; branch: string; grad_year: number | null; phone: string; location: string; company: string;
  recruiter_verified: boolean; plan: string; plan_expires_at: string | null; credits: number;
  free_interview_available: boolean; consented: boolean; csrf: string;
};
export type AppConfig = { ats_unlock: number; payments: "live" | "test" | "off"; ai: boolean; interview_minutes: number };

export const rupees = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN");
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const fmtSlot = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
