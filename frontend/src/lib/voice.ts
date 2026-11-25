"use client";
// Speech in and out, both inside the browser. Nothing here talks to our server.
import { useCallback, useEffect, useRef, useState } from "react";

type Persona = { pitch: number; rate: number; voice: string };

function pickVoice(persona: Persona): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (!voices.length) return null;
  const female = /female|woman|zira|heera|veena|samantha|karen|moira|tessa|neerja|aditi|raveena|google uk english female|google us english/i;
  const male = /\bmale\b|\bman\b|david|ravi|rishi|daniel|alex|fred|prabhat|hemant|google uk english male/i;
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang === "en-IN" ? 6 : v.lang.startsWith("en-GB") ? 3 : v.lang.startsWith("en") ? 2 : -10) +
    ((persona.voice === "female" ? female : male).test(v.name) ? 4 : 0) + (v.localService ? 0 : 1);
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

/** Speaks queued lines in order. `level` (0..1) drives the portrait's mouth. */
export function useSpeaker(persona: Persona | null) {
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const personaRef = useRef(persona);
  personaRef.current = persona;

  const next = useCallback(() => {
    const synth = window.speechSynthesis;
    const text = queue.current.shift();
    if (!text) {
      busy.current = false;
      setSpeaking(false);
      setLevel(0);
      if (timer.current) clearInterval(timer.current);
      return;
    }
    busy.current = true;
    setSpeaking(true);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setLevel(0.25 + Math.random() * 0.75), 110);
    const done = () => next();
    if (!synth) {
      // No speech engine: hold the "speaking" state for roughly the reading time.
      setTimeout(done, Math.min(9000, 900 + text.length * 45));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const p = personaRef.current;
    const v = p ? pickVoice(p) : null;
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-IN";
    u.pitch = p?.pitch ?? 1;
    u.rate = p?.rate ?? 1;
    // Some engines never fire onend; a watchdog keeps the interview moving.
    const guard = setTimeout(done, 4000 + text.length * 110);
    u.onend = u.onerror = () => { clearTimeout(guard); done(); };
    synth.speak(u);
  }, []);

  const say = useCallback((text: string) => {
    queue.current.push(text);
    if (!busy.current) next();
  }, [next]);

  const stop = useCallback(() => {
    queue.current = [];
    window.speechSynthesis?.cancel();
    busy.current = false;
    setSpeaking(false);
    setLevel(0);
    if (timer.current) clearInterval(timer.current);
  }, []);

  useEffect(() => {
    window.speechSynthesis?.getVoices(); // triggers async voice loading in Chrome
    return () => { window.speechSynthesis?.cancel(); if (timer.current) clearInterval(timer.current); };
  }, []);

  return { say, stop, speaking, level };
}

type Rec = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

/** Continuous speech-to-text. Calls onFinal with each finished phrase. */
export function useListener(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [denied, setDenied] = useState(false);
  const rec = useRef<Rec | null>(null);
  const want = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-IN";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) cb.current(t.trim());
        else live += t;
      }
      setInterim(live);
    };
    r.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { want.current = false; setDenied(true); setListening(false); } };
    r.onend = () => {
      setInterim("");
      if (want.current) { try { r.start(); } catch { /* already starting */ } } else setListening(false);
    };
    rec.current = r;
    return () => { want.current = false; r.onend = null; try { r.abort(); } catch { /* not running */ } };
  }, []);

  const start = useCallback(() => {
    if (!rec.current || want.current) return;
    want.current = true;
    setListening(true);
    try { rec.current.start(); } catch { /* already running */ }
  }, []);
  const stop = useCallback(() => {
    want.current = false;
    setListening(false);
    setInterim("");
    try { rec.current?.stop(); } catch { /* not running */ }
  }, []);

  return { supported, denied, listening, interim, start, stop };
}
