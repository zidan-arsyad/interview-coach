// The interview-day cue card: clock, plan, pinned messages, and your cards one keystroke away.
// Rendered in an always-on-top picture-in-picture window, or inline as a preview.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cards, card as cardById, likelyCards, messages, segments, type Card } from "../content/interview.ts";
import { zhSet } from "../content/zh.ts";
import { readablePinyin } from "../lib/pinyin.ts";
import type { SavedAnswer } from "../lib/api.ts";
import { useApp } from "../state.tsx";
import { countdown, getSlot, slotStart, timeThem, timeYou, zones } from "../lib/time.ts";
import { load, save } from "../lib/store.ts";
import { useInterval } from "../components.tsx";

const QUICK: { key: string; id: string; label: string }[] = [
  { key: "1", id: "survival", label: "中文 SOS" },
  { key: "2", id: "bridges", label: "Bridges" },
  { key: "3", id: "your-questions", label: "My questions" },
  { key: "4", id: "closing", label: "Closing" },
  { key: "5", id: "slides", label: "Slides" },
  { key: "6", id: "intro-zh", label: "中文 intro" },
];

// Shared between the inline preview and the pop-out (same JavaScript context).
const baseListeners = new Set<() => void>();
const baseKey = () => {
  const s = getSlot();
  return `overlay:base:${s.date}T${s.start}`;
};
function readBase(): number {
  return load<number>(baseKey(), 0) || slotStart(getSlot()).getTime();
}
function writeBase(ms: number | null) {
  save(baseKey(), ms ?? 0);
  baseListeners.forEach((fn) => fn());
}

export function search(query: string): Card[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: { c: Card; score: number }[] = [];
  const wordStart = (text: string, t: string) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
  for (const c of cards) {
    const title = c.title.toLowerCase();
    const keys = `${c.keys ?? ""} ${c.question ?? ""} ${c.id}`.toLowerCase();
    const body = c.cues.join(" ").toLowerCase();
    let score = 0;
    let all = true;
    for (const t of terms) {
      if (wordStart(title, t)) score += 4;
      else if (wordStart(keys, t)) score += 3;
      else if (title.includes(t)) score += 2;
      else if (keys.includes(t) || wordStart(body, t)) score += 1;
      else if (body.includes(t)) score += 0.5;
      else all = false;
    }
    if (all) scored.push({ c, score });
  }
  // Ties keep the cards' order, which puts the likeliest questions first.
  return scored.sort((a, b) => b.score - a.score).slice(0, 6).map((s) => s.c);
}

/** Your saved practice for a card. The case card shows your 6 C's answer, or else your latest case. */
function savedFor(answers: Record<string, SavedAnswer>, id: string): SavedAnswer | undefined {
  if (id !== "case") return answers[id];
  const cases = Object.entries(answers).filter(([k]) => k.startsWith("case-"));
  return answers["case-universal"] ?? cases.map(([, a]) => a).sort((a, b) => b.at - a.at)[0];
}

export function Overlay({ win, embedded = false }: { win: Window; embedded?: boolean }) {
  const { detail, answers } = useApp();
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 500, win);
  const [base, setBase] = useState(readBase);
  useEffect(() => {
    const fn = () => setBase(readBase());
    baseListeners.add(fn);
    return () => void baseListeners.delete(fn);
  }, []);

  const slot = getSlot();
  const elapsedMin = (now - base) / 60000;
  const seg = segments.find((s) => elapsedMin >= s.from && elapsedMin < s.to);
  const before = elapsedMin < 0;
  const after = elapsedMin >= slot.minutes;
  const autoCard = before ? "intro-en" : after ? "closing" : (seg?.card ?? "home");
  const segKey = before ? "before" : after ? "after" : (seg?.id ?? "none");

  // A card you pick stays until you pick another, press Esc/0, or the plan moves to the next part.
  const [manual, setManual] = useState<{ id: string; seg: string } | null>(null);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [full, setFull] = useState(false);
  const [scale, setScale] = useState(() => load("overlay:scale", 1));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => save("overlay:scale", scale), [scale]);

  const matches = useMemo(() => search(query), [query]);
  const shownId = manual && manual.seg === segKey ? manual.id : autoCard;
  const saved = savedFor(answers, shownId);

  const pick = (id: string) => {
    setManual({ id, seg: segKey });
    setQuery("");
    setHi(0);
    setFull(false);
    input.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && matches.length) {
      e.preventDefault();
      pick(matches[Math.min(hi, matches.length - 1)].id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else setManual(null);
    } else if (!query && /^[0-6]$/.test(e.key)) {
      e.preventDefault();
      if (e.key === "0") setManual(null);
      else pick(QUICK.find((q) => q.key === e.key)!.id);
    }
  };

  // Header: where we are in the plan.
  let planText: string;
  let planTone = "ok";
  if (before) planText = `Starts in ${countdown(base - now)}`;
  else if (after) {
    planText = `Slot ended ${countdown(now - base - slot.minutes * 60000)} ago`;
    planTone = "over";
  } else {
    const left = (seg!.to - elapsedMin) * 60000;
    planText = `${seg!.label} · ${countdown(left)} left · done by ${timeThem(new Date(base + seg!.to * 60000))}`;
    if (left < 15000) planTone = "soon";
  }
  const nowDate = new Date(now);

  return (
    <div className={`overlay${embedded ? " overlay-embedded" : ""}`} style={{ ["--ov-scale" as string]: scale }} onMouseUp={() => win.getSelection()?.isCollapsed && input.current?.focus()}>
      <div className="ov-top">
        <span className="ov-clock">
          {zones.them.label} {timeThem(nowDate, true)} · {zones.you.label} {timeYou(nowDate, true)}
        </span>
        <span className={`ov-plan ov-plan-${planTone}`}>{planText}</span>
        <button className="ov-btn" onClick={() => writeBase(Date.now())} title="The interview started just now: line the plan up with it">
          Start now
        </button>
        {base !== slotStart(slot).getTime() && (
          <button className="ov-btn" onClick={() => writeBase(null)} title={`Back to the planned ${slot.start} start`}>
            Reset
          </button>
        )}
        {!embedded && (
          <button className="ov-btn ov-close" onClick={() => win.close()} title="Close the overlay" aria-label="Close the overlay">
            ✕
          </button>
        )}
      </div>

      <div className="ov-messages">
        {messages.map((m) => (
          <span key={m.id}>▸ {m.short}</span>
        ))}
      </div>

      <div className="ov-search">
        <input
          ref={input}
          autoFocus={!embedded}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHi(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Type to find a card (stress, why, case…) · Enter opens · Esc back"
          spellCheck={false}
        />
      </div>

      <div className="ov-body">
        {query ? (
          <ul className="ov-matches">
            {matches.length ? (
              matches.map((c, i) => (
                <li key={c.id}>
                  <button className={i === hi ? "on" : ""} onMouseEnter={() => setHi(i)} onClick={() => pick(c.id)}>
                    {c.title}
                  </button>
                </li>
              ))
            ) : (
              <li className="ov-muted">No card matches “{query}”.</li>
            )}
          </ul>
        ) : shownId === "home" ? (
          <HomeView pick={pick} />
        ) : (
          <CardView card={cardById(shownId)} detail={detail} full={full} saved={saved} />
        )}
      </div>

      <div className="ov-bottom">
        {QUICK.map((q) => (
          <button key={q.key} className={`ov-btn${shownId === q.id ? " on" : ""}`} onClick={() => pick(q.id)}>
            <b>{q.key}</b> {q.label}
          </button>
        ))}
        <button className="ov-btn" onClick={() => setManual(null)}>
          <b>0</b> Auto
        </button>
        <span className="ov-spacer" />
        {shownId !== "home" && (cardById(shownId).full || saved?.tighter) && (
          <button className={`ov-btn${full ? " on" : ""}`} onClick={() => setFull((f) => !f)}>
            Full text
          </button>
        )}
        <button className="ov-btn" onClick={() => setScale((s: number) => Math.max(0.7, +(s - 0.1).toFixed(1)))} aria-label="Smaller text">
          A−
        </button>
        <button className="ov-btn" onClick={() => setScale((s: number) => Math.min(1.8, +(s + 0.1).toFixed(1)))} aria-label="Bigger text">
          A+
        </button>
      </div>
    </div>
  );
}

function HomeView({ pick }: { pick: (id: string) => void }) {
  return (
    <div className="ov-home">
      <div className="ov-title">Their questions: hear the whole question, then type a word</div>
      <div className="ov-chips">
        {likelyCards.map((id) => (
          <button key={id} className="ov-chip" onClick={() => pick(id)}>
            {cardById(id).title}
          </button>
        ))}
      </div>
      <ul className="ov-cues ov-small">
        {cardById("bridges").cues.slice(0, 3).map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

function CardView({ card, detail, full, saved }: { card: Card; detail: (id: string) => string; full: boolean; saved?: SavedAnswer }) {
  const lines = card.zhSet ? zhSet(card.zhSet).lines : [];
  const notes = (card.details ?? []).map((id) => detail(id)).filter(Boolean);
  return (
    <div className="ov-card">
      <div className="ov-title">{card.title}</div>
      {lines.length > 0 && (
        <div className="ov-zh-list">
          {lines.map((l) => (
            // Pinyin first and largest: it's what you read at a glance; the characters are a reminder.
            <div key={l.id} className="ov-zh">
              <div className="ov-py">{readablePinyin(l.zh, l.py)}</div>
              <div className="ov-zh-chars" lang="zh-TW">
                {l.zh}
              </div>
            </div>
          ))}
        </div>
      )}
      {full && (card.full || saved?.tighter) ? (
        <div className="ov-full">
          {saved?.tighter && (
            <>
              <div className="ov-label">Your practised version ({saved.rating}/5)</div>
              {saved.tighter.split("\n").map((p, i) => (
                <p key={`s${i}`}>{p}</p>
              ))}
              {card.full && <div className="ov-label">Prepared answer</div>}
            </>
          )}
          {card.full?.split("\n").map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <>
          <ul className="ov-cues">
            {card.cues.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          {saved && saved.cues.length > 0 && <div className="ov-practice">★ From practice: {saved.cues.join(" · ")}</div>}
        </>
      )}
      {notes.map((n, i) => (
        <div key={i} className="ov-note">
          {n}
        </div>
      ))}
    </div>
  );
}
