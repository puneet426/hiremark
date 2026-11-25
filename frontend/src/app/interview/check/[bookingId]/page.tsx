"use client";
import { Check, Loader2, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import { BackButton, Button, cx, Eyebrow, LinkButton, Logo, Notice, Spinner } from "../../../../components/ui";

type CheckState = "wait" | "ok" | "bad";
const RULES = [
  "Your camera and microphone stay on. Your face must stay visible. No video is recorded or sent anywhere.",
  "The interview runs in full screen. Leaving full screen or switching tabs is a warning.",
  "You can paste only text you copied inside the editor during this interview. Anything else is blocked and logged.",
  "Each hint you ask for is recorded and lowers your score.",
  "Three warnings end the interview. A result with any warning cannot be published.",
  "If your connection drops, you may rejoin once within five minutes.",
];

export default function PreCheck() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user, loading, config } = useAuth();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState<CheckState>("wait");
  const [mic, setMic] = useState<CheckState>("wait");
  const [net, setNet] = useState<CheckState>("wait");
  const [speech, setSpeech] = useState<CheckState>("wait");
  const [level, setLevel] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  useEffect(() => {
    let raf = 0, ctx: AudioContext | null = null, heard = false, stopped = false;
    setSpeech("webkitSpeechRecognition" in window || "SpeechRecognition" in window ? "ok" : "bad");
    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 }, audio: true }).then((s) => {
      if (stopped) return s.getTracks().forEach((t) => t.stop());
      stream.current = s;
      setCam(s.getVideoTracks().length ? "ok" : "bad");
      if (video.current) video.current.srcObject = s;
      ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(peak / 128);
        if (peak > 12 && !heard) { heard = true; setMic("ok"); }
        raf = requestAnimationFrame(loop);
      };
      loop();
    }).catch(() => { setCam("bad"); setMic("bad"); });

    (async () => {
      const times: number[] = [];
      for (let i = 0; i < 4; i++) {
        const t = performance.now();
        try { await fetch("/api/health", { cache: "no-store" }); times.push(performance.now() - t); } catch { /* counted as failure below */ }
      }
      if (times.length < 3) return setNet("bad");
      const med = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
      setLatency(Math.round(med));
      setNet(med < 800 ? "ok" : "bad");
    })();

    return () => { stopped = true; cancelAnimationFrame(raf); ctx?.close(); stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const start = async () => {
    setBusy(true); setError("");
    try { await document.documentElement.requestFullscreen(); } catch { /* the room asks again */ }
    try {
      const d = await api<{ interview_id: string }>(`/booking/${bookingId}/start`, { method: "POST" });
      stream.current?.getTracks().forEach((t) => t.stop());
      router.replace(`/interview/${d.interview_id}`);
    } catch (e) {
      setError((e as Error).message); setBusy(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  };

  if (loading || !user) return <div className="px-5"><Spinner /></div>;
  const rows: [string, CheckState, string][] = [
    ["Camera", cam, cam === "bad" ? "Allow camera access in the address bar, then reload." : "Your face should be clearly visible."],
    ["Microphone", mic, mic === "bad" ? "Allow microphone access, then reload." : mic === "ok" ? "We can hear you." : "Say a few words. The interview starts once we hear you."],
    ["Voice recognition", speech, speech === "bad" ? "This browser cannot turn speech into text. You can type your answers, or switch to Chrome." : "Supported in this browser."],
    ["Connection", net, net === "bad" ? "The connection is slow or unstable. Move closer to the router." : latency != null ? `Response time ${latency} ms.` : "Testing"],
  ];
  const ready = cam === "ok" && mic === "ok" && net !== "wait" && agree;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
      <div className="flex items-center gap-3"><BackButton fallback="/app" /><Logo size="sm" href="/app" /></div>
      <Eyebrow className="mt-10">Before you enter</Eyebrow>
      <h1 className="display mt-3 text-[44px]">Check your setup and read the rules.</h1>
      {error && <div className="mt-6"><Notice tone="bad">{error}</Notice></div>}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-panel">
            <video ref={video} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            {cam !== "ok" && <p className="absolute inset-0 flex items-center justify-center text-sm text-faint">{cam === "bad" ? "Camera unavailable" : "Waiting for the camera"}</p>}
            <div className="absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full bg-good transition-[width] duration-75" style={{ width: `${Math.min(100, level * 160)}%` }} /></div>
          </div>
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
            {rows.map(([name, st, note]) => (
              <li key={name} className="flex items-center gap-3 px-4 py-3">
                <span className={cx("flex h-6 w-6 items-center justify-center rounded-full", st === "ok" ? "bg-good/15 text-good" : st === "bad" ? "bg-bad/15 text-bad" : "text-faint")}>
                  {st === "ok" ? <Check className="h-3.5 w-3.5" /> : st === "bad" ? <X className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </span>
                <span className="w-36 text-sm text-fg">{name}</span><span className="flex-1 text-[13px] text-muted">{note}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-panel p-6">
          <Eyebrow>The rules</Eyebrow>
          <ol className="mt-4 space-y-3.5">
            {RULES.map((r, i) => <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted"><span className="num pt-px text-[12px] text-mark">{String(i + 1).padStart(2, "0")}</span>{r}</li>)}
          </ol>
          <label className="mt-6 flex gap-3 border-t border-line pt-5 text-sm text-fg">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0a0a0a]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I have read the rules and I am ready for {config?.interview_minutes ?? 40} uninterrupted minutes.
          </label>
          <div className="mt-5 flex items-center gap-3">
            <Button size="lg" disabled={!ready} busy={busy} onClick={start}>Start the interview</Button>
            <LinkButton href="/app/book" variant="ghost">Not now</LinkButton>
          </div>
          <p className="mt-3 text-[12px] text-faint">The clock starts as soon as you press Start. One interview credit is used.</p>
        </div>
      </div>
    </main>
  );
}
