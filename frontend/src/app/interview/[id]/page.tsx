"use client";
import { AlertTriangle, Lightbulb, Maximize, Mic, MicOff, PhoneOff, Play, RotateCcw, Send, Video, VideoOff } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, clock } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useProctor } from "../../../lib/proctor";
import { useListener, useSpeaker } from "../../../lib/voice";
import { CodeEditor } from "../../../components/code-editor";
import { Interviewer, Portrait } from "../../../components/portrait";
import { Button, cx, Eyebrow, Logo, Spinner } from "../../../components/ui";

type Msg = { seq: number; role: "interviewer" | "student" | "system"; text: string; segment: string };
type Problem = { id: string; title: string; statement: string; input: string; output: string; constraints: string; samples: { input: string; output: string }[] };
type View = {
  id: string; status: "active" | "completed" | "terminated"; interviewer: Interviewer;
  segment: { index: number; key: string; label: string; remaining: number; seconds: number };
  segments: { key: string; label: string; seconds: number }[]; total_remaining: number; messages: Msg[];
  warnings: number; max_warnings: number; hints: number;
  dsa: { phase: "approach" | "coding" | "review"; last_result: { passed: number; total: number } | null; problem: Problem | null };
  editor: { enabled: boolean; snippet: { code: string; language: string } | null };
  code: string; language: string; languages: { id: string; label: string; monaco: string }[];
};
type RunResult = {
  kind: "run" | "submit"; passed: number; total: number;
  tests?: { input: string; expected: string; status: string; passed: boolean; stdout: string; stderr: string; ms: number }[];
  first_failure?: { status: string; stderr: string } | null;
};

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [view, setView] = useState<View | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [fatal, setFatal] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [code, setCode] = useState("");
  const [running, setRunning] = useState<"" | "run" | "submit">("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [toast, setToast] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const seq = useRef(0);
  const first = useRef(true);
  const codeLoaded = useRef(false);
  const dirty = useRef(false);
  const codeRef = useRef("");
  const fromSpeech = useRef(false);
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  const sendRef = useRef<() => void>(() => {});
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const active = view?.status === "active";
  const ended = !!view && view.status !== "active";

  const speaker = useSpeaker(view?.interviewer ?? null);
  const say = speaker.say;
  const flash = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(""), 5000); }, []);

  // --- server state ---------------------------------------------------
  const apply = useCallback((v: View) => {
    setView(v);
    setRemaining(v.segment.remaining);
    if (!codeLoaded.current) { codeLoaded.current = true; codeRef.current = v.code; setCode(v.code); }
    const fresh = v.messages.filter((m) => m.seq > seq.current);
    if (!fresh.length) return;
    seq.current = fresh[fresh.length - 1].seq;
    setMessages((prev) => [...prev, ...fresh]);
    // On a rejoin, earlier lines are shown but not read aloud again.
    const speakable = first.current ? (v.messages.length === 1 ? fresh : fresh.slice(-1).filter((m) => m.role === "interviewer")) : fresh;
    speakable.filter((m) => m.role !== "student").forEach((m) => say(m.text));
  }, [say]);

  const poll = useCallback(async () => {
    try {
      apply(await api<View>(`/interviews/${id}/state?after=${seq.current}`));
      first.current = false;
    } catch (e) {
      if ((e as ApiError).status === 404 || (e as ApiError).status === 401) setFatal((e as Error).message);
    }
  }, [id, apply]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/login"); return; }
    poll();
    const t = setInterval(poll, 2500);
    return () => clearInterval(t);
  }, [loading, user, poll, router]);

  // Local one-second countdown between polls; the server clock stays the authority.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [active]);

  // --- integrity ------------------------------------------------------
  const report = useCallback((kind: string, detail = "") => {
    api<{ warnings: number; status: string }>(`/interviews/${id}/event`, { body: { kind, detail } }).then(() => poll()).catch(() => {});
  }, [id, poll]);
  const proctor = useProctor(!!active, report);

  // --- answering ------------------------------------------------------
  const send = useCallback(async () => {
    const text = draftRef.current.trim();
    if (!text || sending) return;
    if (silence.current) clearTimeout(silence.current);
    setSending(true);
    setDraft(""); draftRef.current = ""; fromSpeech.current = false;
    try { apply(await api<View>(`/interviews/${id}/turn?after=${seq.current}`, { body: { text: text.slice(0, 2000) } })); }
    catch (e) { flash((e as Error).message); setDraft(text); draftRef.current = text; }
    setSending(false);
  }, [id, apply, sending, flash]);
  sendRef.current = send;

  const listener = useListener((phrase) => {
    if (!phrase) return;
    const next = (draftRef.current + " " + phrase).trim();
    draftRef.current = next; setDraft(next); fromSpeech.current = true;
    // A natural pause after speaking sends what was said, as in a live conversation.
    if (silence.current) clearTimeout(silence.current);
    silence.current = setTimeout(() => { if (fromSpeech.current) sendRef.current(); }, 2200);
  });

  const coding = view?.segment.key === "dsa" && view.dsa.phase === "coding";
  // The microphone is live for the whole interview, like a call. It pauses only while the
  // interviewer is speaking, so the interviewer's own voice is not picked up as an answer.
  const [micOn, setMicOn] = useState(true);
  const quick = async (text: string) => {
    if (sending) return;
    setSending(true);
    try { apply(await api<View>(`/interviews/${id}/turn?after=${seq.current}`, { body: { text } })); } catch (e) { flash((e as Error).message); }
    setSending(false);
  };
  const { start: startListening, stop: stopListening, supported: canListen } = listener;
  useEffect(() => {
    if (active && micOn && !speaker.speaking && !sending && canListen) startListening();
    else stopListening();
  }, [active, micOn, speaker.speaking, sending, canListen, startListening, stopListening]);

  useEffect(() => { transcriptEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, listener.interim]);

  // --- code -----------------------------------------------------------
  const onCode = (v: string) => { setCode(v); codeRef.current = v; dirty.current = true; };
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      api(`/interviews/${id}/code`, { method: "PUT", body: { code: codeRef.current } }).catch(() => { dirty.current = true; });
    }, 3000);
    return () => clearInterval(t);
  }, [id, active]);

  const execute = async (kind: "run" | "submit") => {
    setRunning(kind); setResult(null); dirty.current = false;
    try { setResult(await api<RunResult>(`/interviews/${id}/${kind}`, { body: { code: codeRef.current } })); poll(); }
    catch (e) { flash((e as Error).message); }
    setRunning("");
  };
  const [pendingLang, setPendingLang] = useState("");
  const changeLanguage = async (language: string) => {
    setPendingLang("");
    try { const d = await api<{ code: string }>(`/interviews/${id}/language`, { body: { language } }); codeRef.current = d.code; setCode(d.code); dirty.current = false; setResult(null); poll(); }
    catch (e) { flash((e as Error).message); }
  };
  const hint = async () => { try { apply(await api<View>(`/interviews/${id}/hint?after=${seq.current}`, { method: "POST" })); } catch (e) { flash((e as Error).message); } };
  const end = async () => { setConfirmEnd(false); await api(`/interviews/${id}/end`, { method: "POST" }).catch(() => {}); poll(); };

  // --- finished -------------------------------------------------------
  useEffect(() => {
    if (ended) {
      stopListening();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }, [ended, stopListening]);

  if (fatal) return <main className="mx-auto max-w-md px-5 py-24 text-center"><p className="text-fg">{fatal}</p><Button className="mt-6" onClick={() => router.replace("/app")}>Back to dashboard</Button></main>;
  if (!view) return <div className="px-5"><Spinner label="Opening the interview room" /></div>;

  if (view.status !== "active") {
    return (
      <main className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-5 py-24 text-center">
        <Portrait person={view.interviewer} size={96} speaking={speaker.speaking} level={speaker.level} />
        <h1 className="display mt-8 text-[44px]">{view.status === "completed" ? "The interview is over." : "The interview was ended."}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {view.status === "completed" ? "Your answers have been scored. The report shows your verdict, the best answer to every question, and what to fix first."
            : (messages.filter((m) => m.role === "system").slice(-1)[0]?.text || "It ended before completion.") + " Your report shows what was recorded."}
        </p>
        <Button size="lg" className="mt-8" onClick={() => { speaker.stop(); router.replace(`/app/results/${view.id}`); }}>See your result</Button>
      </main>
    );
  }

  const lastQuestion = [...messages].reverse().find((m) => m.role === "interviewer");
  const status = speaker.speaking ? "Speaking" : sending ? "Thinking" : listener.listening ? (coding ? "Listening while you code" : "Listening") : !micOn ? "You are muted" : "Waiting for you";
  const low = remaining <= 30;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink">
      {/* Top bar: segment progress and warnings */}
      <header className="flex h-[52px] shrink-0 items-center gap-5 border-b border-line px-4">
        <Logo size="sm" href={null} />
        <ol className="flex flex-1 items-center gap-1.5" aria-label="Interview progress">
          {view.segments.map((s, i) => {
            const cur = i === view.segment.index, done = i < view.segment.index;
            const pct = cur ? 100 - (remaining / s.seconds) * 100 : done ? 100 : 0;
            return (
              <li key={s.key} className="min-w-0" style={{ flex: Math.max(1, s.seconds / 60) }}>
                <div className="h-1 overflow-hidden rounded-full bg-line"><div className={cx("h-full", cur ? "bg-mark" : "bg-faint")} style={{ width: `${pct}%` }} /></div>
                <p className={cx("mt-1 truncate text-[11px]", cur ? "text-fg" : "text-faint")}>{s.label}</p>
              </li>
            );
          })}
        </ol>
        <div className={cx("num text-[15px]", low ? "text-warn" : "text-fg")} aria-label="Time left in this part" title="Time left in this part">{clock(remaining)}</div>
        <div className={cx("flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px]", view.warnings ? "border-warn/50 text-warn" : "border-line text-muted")} title="Integrity warnings">
          <AlertTriangle className="h-3.5 w-3.5" /><span className="num">{view.warnings}/{view.max_warnings}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,400px)_1fr]">
        {/* Left: interviewer and conversation */}
        <aside className="flex min-h-0 flex-col border-r border-line">
          {/* The interviewer's "video" frame, laid out like a call */}
          <div className={cx("relative aspect-[16/10] shrink-0 overflow-hidden border-b bg-black transition-colors", speaker.speaking ? "border-mark" : "border-line")}>
            <Portrait person={view.interviewer} scene speaking={speaker.speaking} level={speaker.level} />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/25" />
            <div className={cx("absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/65 px-2.5 py-1 text-[12px] backdrop-blur", speaker.speaking ? "text-white" : listener.listening ? "text-good" : "text-white/70")} aria-live="polite">
              {speaker.speaking ? (
                <span className="flex h-3 items-end gap-[2px]" aria-hidden>{[0.5, 1, 0.7].map((m, i) => <span key={i} className="w-[2px] rounded-full bg-white" style={{ height: `${25 + speaker.level * 75 * m}%` }} />)}</span>
              ) : <span className={cx("h-1.5 w-1.5 rounded-full", listener.listening ? "listening bg-good" : "bg-white/50")} />}
              {status}
            </div>
            <div className="absolute bottom-3 left-3 right-32">
              <p className="text-[15px] font-medium leading-tight text-white">{view.interviewer.name}</p>
              <p className="truncate text-[12px] text-white/65">{view.interviewer.title}</p>
            </div>
            <div className="absolute bottom-3 right-3 h-[68px] w-[104px] overflow-hidden rounded-lg border border-white/20 bg-panel shadow-xl" title="Your camera. It is checked in your browser only; nothing is recorded.">
              <video ref={proctor.videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
              <span className={cx("absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px]", proctor.camera !== "on" || proctor.faces === 0 || (proctor.faces ?? 1) > 1 ? "text-warn" : "text-good")}>
                {proctor.camera === "on" ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                {proctor.camera !== "on" ? "Camera off" : proctor.faceCheck !== "on" ? "You" : proctor.faces === 0 ? "No face" : (proctor.faces ?? 1) > 1 ? `${proctor.faces} faces` : "You"}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2">
            {listener.supported && (
              <button onClick={() => setMicOn(!micOn)} aria-pressed={!micOn} aria-label={micOn ? "Mute microphone" : "Unmute microphone"} title={micOn ? "Mute" : "Unmute"}
                className={cx("flex h-9 w-9 items-center justify-center rounded-full", micOn ? "bg-raised text-fg hover:bg-line" : "bg-bad text-white")}>
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>
            )}
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-full", proctor.camera === "on" ? "bg-raised text-fg" : "bg-bad text-white")} title="Your camera stays on for the whole interview">
              {proctor.camera === "on" ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </span>
            <button onClick={() => quick("Could you repeat the question?")} disabled={sending} className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-[13px] text-muted hover:bg-line hover:text-fg disabled:opacity-50">
              <RotateCcw className="h-3.5 w-3.5" />Repeat
            </button>
            <button onClick={hint} disabled={sending} title="You can also just ask aloud. Every hint is recorded and lowers your score." className="flex h-9 items-center gap-1.5 rounded-full bg-raised px-3 text-[13px] text-muted hover:bg-line hover:text-fg disabled:opacity-50">
              <Lightbulb className="h-3.5 w-3.5" />Hint{view.hints > 0 && <span className="num text-faint">{view.hints}</span>}
            </button>
            <span className="flex-1" />
            <button onClick={() => setConfirmEnd(true)} aria-label="End interview" title="End interview" className="flex h-9 w-12 items-center justify-center rounded-full bg-bad/90 text-white hover:bg-bad"><PhoneOff className="h-4 w-4" /></button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-label="Conversation" role="log">
            {messages.map((m) => m.role === "system" ? (
              <p key={m.seq} className="rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-[13px] text-warn">{m.text}</p>
            ) : (
              <div key={m.seq} className={cx("rise", m.role === "student" && "pl-8")}>
                <p className="num mb-1 text-[10px] text-faint">{m.role === "student" ? "You" : view.interviewer.name}</p>
                <p className={cx("text-sm leading-relaxed", m.role === "student" ? "text-muted" : "text-fg")}>{m.text}</p>
              </div>
            ))}
            {listener.interim && <p className="pl-8 text-sm italic leading-relaxed text-faint">{listener.interim}</p>}
            <div ref={transcriptEnd} />
          </div>

          {/* Composer */}
          <div className="border-t border-line p-3">
            <div className="rounded-lg border border-line bg-panel focus-within:border-faint">
              <textarea
                value={draft} rows={2} maxLength={2000} aria-label="Your answer"
                placeholder={listener.supported && micOn ? "Just speak. Ask a question, think aloud, or ask for a hint." : "Type here and press Enter."}
                className="block w-full resize-none bg-transparent px-3 py-2.5 text-sm text-fg placeholder:text-faint focus:outline-none"
                onChange={(e) => { setDraft(e.target.value); draftRef.current = e.target.value; fromSpeech.current = false; if (silence.current) clearTimeout(silence.current); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                onPaste={(e) => { e.preventDefault(); report("paste_blocked", "Paste into the answer box"); flash("Pasting is not allowed in the interview."); }}
                onDrop={(e) => { e.preventDefault(); report("drop_blocked", "Drop into the answer box"); }}
              />
              <div className="flex items-center gap-2 px-2 pb-2">
                <span className="pl-1 text-[12px] text-faint">{listener.supported ? (micOn ? "Live captions of what you say appear above. You can also type." : "You are muted. Unmute to speak, or type.") : "Voice input is not available in this browser. Type your answers."}</span>
                <span className="flex-1" />
                <Button size="sm" busy={sending} disabled={!draft.trim()} onClick={send}><Send className="h-3.5 w-3.5" />Send</Button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: the work surface */}
        <section className="flex min-h-0 min-w-0 flex-col">
          {view.segment.key === "dsa" && view.dsa.problem ? (
            <>
              <div className="max-h-[38%] shrink-0 overflow-y-auto border-b border-line px-6 py-5">
                <Eyebrow>Coding problem</Eyebrow>
                <h2 className="mt-2 text-[19px] font-medium text-fg">{view.dsa.problem.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{view.dsa.problem.statement}</p>
                <dl className="mt-3 grid max-w-3xl gap-x-8 gap-y-1 text-[13px] sm:grid-cols-[auto_1fr]">
                  <dt className="text-faint">Input</dt><dd className="text-muted">{view.dsa.problem.input}</dd>
                  <dt className="text-faint">Output</dt><dd className="text-muted">{view.dsa.problem.output}</dd>
                  <dt className="text-faint">Limits</dt><dd className="text-muted">{view.dsa.problem.constraints}</dd>
                </dl>
                <div className="mt-4 flex flex-wrap gap-3">
                  {view.dsa.problem.samples.map((s, i) => (
                    <div key={i} className="min-w-[220px] rounded-lg border border-line bg-panel p-3">
                      <p className="num text-[10px] text-faint">Sample {i + 1}</p>
                      <pre className="num mt-1.5 whitespace-pre-wrap text-[13px] text-fg">{s.input.trimEnd() || "(empty line)"}</pre>
                      <pre className="num mt-1.5 border-t border-line pt-1.5 text-[13px] text-good">{s.output}</pre>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
                <select aria-label="Language" value={view.language} disabled={!view.editor.enabled} onChange={(e) => setPendingLang(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-panel px-2 text-[13px] text-fg">
                  {view.languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <span className="flex-1 text-[12px] text-faint">{view.editor.enabled ? "Read from standard input, print to standard output." : "Coding is closed. Answer the interviewer's questions about your solution."}</span>
                <Button size="sm" variant="secondary" busy={running === "run"} disabled={!view.editor.enabled || !!running} onClick={() => execute("run")}><Play className="h-3.5 w-3.5" />Run samples</Button>
                <Button size="sm" busy={running === "submit"} disabled={!view.editor.enabled || !!running} onClick={() => execute("submit")}>Submit</Button>
              </div>
              <div className="min-h-0 flex-1">
                <CodeEditor value={code} language={view.languages.find((l) => l.id === view.language)?.monaco || "python"} readOnly={!view.editor.enabled} onChange={onCode}
                  onBlocked={(kind, n) => { report(kind, `${n} characters`); flash("Blocked: you can only paste text you copied inside this editor. This has been logged."); }} />
              </div>
              {(result || running) && (
                <div className="max-h-[32%] shrink-0 overflow-y-auto border-t border-line bg-panel px-5 py-4" aria-live="polite">
                  {running ? <p className="text-sm text-muted">{running === "run" ? "Running the sample tests" : "Running the hidden tests"}…</p> : result && (
                    <>
                      <p className="text-sm text-fg"><span className={cx("num", result.passed === result.total ? "text-good" : "text-warn")}>{result.passed}/{result.total}</span> {result.kind === "run" ? "sample tests pass" : "hidden tests pass"}</p>
                      {result.tests?.map((t, i) => (
                        <div key={i} className="mt-3 border-t border-line pt-3 text-[13px]">
                          <p className={t.passed ? "text-good" : "text-bad"}>Sample {i + 1}: {t.status} <span className="num text-faint">{t.ms} ms</span></p>
                          {!t.passed && (
                            <div className="num mt-2 grid gap-2 sm:grid-cols-2">
                              <div><p className="text-[10px] text-faint">Expected</p><pre className="whitespace-pre-wrap text-muted">{t.expected}</pre></div>
                              <div><p className="text-[10px] text-faint">Your output</p><pre className="whitespace-pre-wrap text-fg">{t.stdout || "(nothing printed)"}</pre></div>
                              {t.stderr && <pre className="col-span-full whitespace-pre-wrap text-bad">{t.stderr}</pre>}
                            </div>
                          )}
                        </div>
                      ))}
                      {result.first_failure && <p className="mt-2 text-[13px] text-muted">First failing test: {result.first_failure.status}. Hidden inputs are not shown.{result.first_failure.stderr && <pre className="num mt-2 whitespace-pre-wrap text-bad">{result.first_failure.stderr}</pre>}</p>}
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-10 pb-6 pt-12">
                <Eyebrow>{view.segment.label}</Eyebrow>
                <p className="display mt-4 max-w-3xl text-[34px] leading-[1.15] text-fg">{lastQuestion?.text.split(/(?<=[.?!])\s+/).slice(-2).join(" ")}</p>
              </div>
              {view.editor.snippet ? (
                <div className="mx-10 mb-10 min-h-0 flex-1 overflow-hidden rounded-lg border border-line">
                  <CodeEditor value={view.editor.snippet.code} language={view.editor.snippet.language} readOnly />
                </div>
              ) : (
                <div className="mt-auto px-10 pb-10 text-sm text-faint">
                  {view.segment.key === "intro" ? "The code editor opens when the coding problem begins." : "Answer aloud. Be specific: say what you did, why, and what happened."}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {toast && <div role="alert" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-warn/50 bg-raised px-4 py-2.5 text-sm text-warn shadow-2xl">{toast}</div>}

      {(proctor.camera === "off" || listener.denied) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/95 p-5" role="dialog" aria-modal="true">
          <div className="max-w-sm text-center">
            {proctor.camera === "off" ? <VideoOff className="mx-auto h-7 w-7 text-bad" /> : <MicOff className="mx-auto h-7 w-7 text-bad" />}
            <p className="mt-4 text-[19px] text-fg">Turn your {proctor.camera === "off" ? "camera" : "microphone"} back on</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">The interview needs both your camera and your microphone, like a video call. Allow access from the icon in the address bar, then reconnect. The clock is still running.</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>Reconnect</Button>
          </div>
        </div>
      )}

      {!proctor.fullscreen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/95 p-5" role="dialog" aria-modal="true">
          <div className="max-w-sm text-center">
            <Maximize className="mx-auto h-7 w-7 text-warn" />
            <p className="mt-4 text-[19px] text-fg">The interview runs in full screen</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">Leaving full screen counts as a warning. The clock is still running.</p>
            <Button className="mt-6" onClick={() => document.documentElement.requestFullscreen().catch(() => flash("Your browser refused full screen."))}>Return to full screen</Button>
          </div>
        </div>
      )}

      {pendingLang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-6">
            <p className="text-[19px] text-fg">Switch to {view.languages.find((l) => l.id === pendingLang)?.label}?</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">Your current code is replaced with a fresh template in the new language. The clock keeps running.</p>
            <div className="mt-6 flex gap-2"><Button onClick={() => changeLanguage(pendingLang)}>Switch language</Button><Button variant="secondary" onClick={() => setPendingLang("")}>Keep my code</Button></div>
          </div>
        </div>
      )}

      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-6">
            <p className="text-[19px] text-fg">End the interview now?</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">Questions you have not reached will score zero, and the interview credit is not returned.</p>
            <div className="mt-6 flex gap-2"><Button variant="danger" onClick={end}>End interview</Button><Button variant="secondary" onClick={() => setConfirmEnd(false)}>Keep going</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
