import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Mic } from "./lib/recorder.ts";
import { formatSeconds } from "./lib/metrics.ts";
import { toneHelp, toneOf } from "./lib/pinyin.ts";
import type { CharScore } from "./lib/zhScore.ts";
import { tokenize } from "./lib/pinyin.ts";

export type Tone = "good" | "warn" | "bad" | "muted" | "accent";

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "info" | "good"; children: ReactNode }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function Chip({ tone = "muted", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function scoreTone(score: number | undefined): Tone {
  if (score === undefined) return "muted";
  if (score >= 85) return "good";
  if (score >= 65) return "warn";
  return "bad";
}

export function Score({ label, value, big }: { label: string; value?: number; big?: boolean }) {
  return (
    <div className={`score score-${scoreTone(value)}${big ? " score-big" : ""}`}>
      <div className="score-value">{value === undefined ? "—" : Math.round(value)}</div>
      <div className="score-label">{label}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Microphone level bar; updates itself so the page doesn't re-render ten times a second. */
export function LevelMeter({ mic, active }: { mic: Mic; active: boolean }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mic.onLevel = (level) => {
      if (bar.current) bar.current.style.transform = `scaleX(${level})`;
    };
    return () => {
      mic.onLevel = null;
    };
  }, [mic]);
  return (
    <div className={`level${active ? " level-on" : ""}`} aria-hidden>
      <div className="level-bar" ref={bar} />
    </div>
  );
}

/** Live mm:ss since a start time, coloured against a target range. */
export function Elapsed({ since, target }: { since: number; target?: [number, number] }) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);
  const s = (now - since) / 1000;
  let tone: Tone = "muted";
  if (target) tone = s < target[0] ? "muted" : s <= target[1] ? "good" : s <= target[1] * 1.25 ? "warn" : "bad";
  return <span className={`elapsed elapsed-${tone}`}>{formatSeconds(s)}</span>;
}

export type RecState = "idle" | "starting" | "recording" | "processing";

export function RecordButton({ state, onClick, idleLabel = "Record", disabled }: { state: RecState; onClick: () => void; idleLabel?: string; disabled?: boolean }) {
  const label = { idle: idleLabel, starting: "Starting…", recording: "Stop", processing: "Scoring…" }[state];
  return (
    <button className={`rec rec-${state}`} onClick={onClick} disabled={disabled || state === "starting" || state === "processing"}>
      <span className="rec-dot" />
      {label}
    </button>
  );
}

/** Ignores keys typed into inputs, and plain keys with modifiers. */
export function useHotkeys(handler: (e: KeyboardEvent) => void, target: Document = document) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      ref.current(e);
    };
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }, [target]);
}

/** A Chinese line with pinyin above each character; coloured by score when given. */
export function ZhLine({ zh, py, scores, size = "lg" }: { zh: string; py: string; scores?: CharScore[]; size?: "sm" | "md" | "lg" }) {
  const tokens = scores?.map((s) => s.token) ?? tokenize(zh, py);
  return (
    <div className={`zh zh-${size}`} lang="zh-TW">
      {tokens.map((t, i) => {
        const score = scores?.[i];
        const cls = `zh-tok zh-${t.kind}${score ? ` st-${score.status}` : ""}`;
        if (t.kind !== "han") return <span key={i} className={cls}>{t.text}</span>;
        const tip = score?.accuracy !== undefined ? `${Math.round(score.accuracy)} · ${t.py} · ${toneHelp[toneOf(t.py)]}` : `${t.py} · ${toneHelp[toneOf(t.py)]}`;
        return (
          <ruby key={i} className={cls} title={tip}>
            {t.text}
            <rt>{t.py}</rt>
          </ruby>
        );
      })}
    </div>
  );
}

export function useInterval(fn: () => void, ms: number, win: Window = window) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = win.setInterval(() => ref.current(), ms);
    return () => win.clearInterval(id);
  }, [ms, win]);
}
