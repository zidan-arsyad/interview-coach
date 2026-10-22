// The interview-day cue card: clock, the interview's steps, your questions with their answers, and
// quick cards one keystroke away. Rendered in an always-on-top picture-in-picture window, or inline
// as a preview.
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

// The steps bar: the plan's parts in order (one per card), then the closing.
const STEPS: { id: string; label: string; card: string }[] = segments.filter((s, i) => segments[i + 1]?.card !== s.card).map((s) => ({ id: s.id, label: s.label, card: s.card }));
if (!STEPS.some((s) => s.card === "closing")) STEPS.push({ id: "closing", label: "Closing", card: "closing" });
const STEP_CARDS = new Set(STEPS.map((s) => s.card));
const QA_STEP = STEPS.find((s) => s.card === "home");

// The question list beside the answers: the likely questions first, then the rest by group.
const QUESTION_GROUPS: { label: string; ids: string[] }[] = [{ label: "Likely", ids: likelyCards.filter((id) => !STEP_CARDS.has(id)) }];
for (const c of cards) {
  if (!c.question || c.group === "Intro" || STEP_CARDS.has(c.id) || QUESTION_GROUPS[0].ids.includes(c.id)) continue;
  const group = QUESTION_GROUPS.find((g) => g.label === c.group);
  if (group) group.ids.push(c.id);
  else QUESTION_GROUPS.push({ label: c.group, ids: [c.id] });
}

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
  const autoCard = before ? (segments[0]?.card ?? "home") : after ? "closing" : (seg?.card ?? "home");

  // A card you pick stays until you pick another, or press Esc/0 to follow the plan again. Picks made
  // before the interview are dropped when it starts, so it opens on the plan's first step.
  const [manual, setManual] = useState<{ id: string; before: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const [showAnswers, setShowAnswers] = useState(() => load("overlay:answers", true));
  const [scale, setScale] = useState(() => load("overlay:scale", 1));
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => save("overlay:scale", scale), [scale]);
  useEffect(() => save("overlay:answers", showAnswers), [showAnswers]);

  const matches = useMemo(() => search(query), [query]);
  const following = !manual || manual.before !== before;
  const shownId = following ? autoCard : manual.id;
  const saved = savedFor(answers, shownId);
  // Each card opens at its top, where the answer is.
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [shownId, query]);

  // Plan steps (intro, slides…) fill the window; everything else shows the question list beside it.
  const onStep = shownId !== "home" && STEP_CARDS.has(shownId);
  const shownStep = onStep ? STEPS.find((s) => s.card === shownId)?.id : QA_STEP?.id;
  const nowStep = before ? undefined : after ? "closing" : STEPS.find((s) => s.card === seg?.card)?.id;

  const pick = (id: string) => {
    setManual({ id, before });
    setQuery("");
    setHi(0);
    input.current?.focus();
  };
  const followPlan = () => {
    setManual(null);
    setQuery("");
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
      else followPlan();
    } else if (!query && /^[0-6]$/.test(e.key)) {
      e.preventDefault();
      if (e.key === "0") followPlan();
      else pick(QUICK.find((q) => q.key === e.key)!.id);
    }
  };

  // Status line: where we are in the plan.
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
      {/* The answer comes first, right under the camera; the controls sit below it. */}
      <div className="ov-main">
        <div className="ov-body" ref={body}>
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
            <HomeView />
          ) : (
            <CardView card={cardById(shownId)} detail={detail} showAnswer={showAnswers} saved={saved} />
          )}
        </div>
        {!onStep && <QuestionList shownId={shownId} pick={pick} answers={answers} />}
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

      <nav className="ov-steps" aria-label="Interview steps">
        {STEPS.map((s) => (
          <button
            key={s.id}
            className={`ov-step${s.id === shownStep ? " on" : ""}${s.id === nowStep ? " now" : ""}`}
            onClick={() => pick(s.card)}
            title={s.id === nowStep ? "Now, by the plan" : undefined}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="ov-quick">
        {QUICK.map((q) => (
          <button key={q.key} className={`ov-btn${shownId === q.id ? " on" : ""}`} onClick={() => pick(q.id)}>
            <b>{q.key}</b> {q.label}
          </button>
        ))}
        <button className={`ov-btn${following ? " on" : ""}`} onClick={followPlan} title="Follow the plan: the card changes with the interview's timing">
          <b>0</b> Plan
        </button>
        <span className="ov-spacer" />
        <button className={`ov-btn${showAnswers ? " on" : ""}`} onClick={() => setShowAnswers((v: boolean) => !v)} title="Show or hide the answers under the cues">
          Answers
        </button>
      </div>

      <div className="ov-messages">
        {messages.map((m) => (
          <span key={m.id}>▸ {m.short}</span>
        ))}
      </div>

      <div className="ov-status">
        <span className="ov-clock">
          {zones.them.label} {timeThem(nowDate, true)} · {zones.you.label} {timeYou(nowDate, true)}
        </span>
        <span className={`ov-plan ov-plan-${planTone}`}>{planText}</span>
        <button className="ov-btn" onClick={() => setScale((s: number) => Math.max(0.7, +(s - 0.1).toFixed(1)))} aria-label="Smaller text">
          A−
        </button>
        <button className="ov-btn" onClick={() => setScale((s: number) => Math.min(1.8, +(s + 0.1).toFixed(1)))} aria-label="Bigger text">
          A+
        </button>
        <button
          className="ov-btn"
          onClick={() => {
            writeBase(Date.now());
            followPlan();
          }}
          title="The interview started just now: line the plan up with it"
        >
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
    </div>
  );
}

function QuestionList({ shownId, pick, answers }: { shownId: string; pick: (id: string) => void; answers: Record<string, SavedAnswer> }) {
  const list = useRef<HTMLElement>(null);
  // Keep the open question in view, e.g. after opening it by search. (Braces: newer browsers return a
  // promise from scrollIntoView, and an effect must return nothing.)
  useEffect(() => {
    list.current?.querySelector(".ov-q.on")?.scrollIntoView({ block: "nearest" });
  }, [shownId]);
  return (
    <nav className="ov-qlist" ref={list} aria-label="Questions">
      {QUESTION_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="ov-qgroup">{g.label}</div>
          {g.ids.map((id) => (
            <button key={id} className={`ov-q${id === shownId ? " on" : ""}`} onClick={() => pick(id)}>
              {cardById(id).title}
              {savedFor(answers, id) && (
                <span className="ov-q-star" title="You practised this">
                  {" "}
                  ★
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}

function HomeView() {
  return (
    <div className="ov-home">
      <div className="ov-title">Hear the whole question, then click it on the right</div>
      <p className="ov-muted ov-hint">Or type a word below (stress, why, case…) and press Enter.</p>
      <ul className="ov-cues ov-small">
        {cardById("bridges").cues.slice(0, 3).map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

function CardView({ card, detail, showAnswer, saved }: { card: Card; detail: (id: string) => string; showAnswer: boolean; saved?: SavedAnswer }) {
  const lines = card.zhSet ? zhSet(card.zhSet).lines : [];
  const notes = (card.details ?? []).map((id) => detail(id)).filter(Boolean);
  // The answer comes first when shown, so it's on screen without scrolling; the keywords follow.
  const answer = showAnswer && Boolean(saved?.tighter || card.full);
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
      {saved && saved.cues.length > 0 && <div className="ov-practice">★ From practice: {saved.cues.join(" · ")}</div>}
      {answer && (
        <div className="ov-full">
          {saved?.tighter && (
            <>
              <div className="ov-label">Your practised version ({saved.rating}/5)</div>
              {saved.tighter.split("\n").map((p, i) => (
                <p key={`s${i}`}>{p}</p>
              ))}
            </>
          )}
          {card.full && (
            <>
              <div className="ov-label">{saved?.tighter ? "Prepared answer" : card.question ? "Recommended answer" : "Full text"}</div>
              {card.full.split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </>
          )}
        </div>
      )}
      {answer && <div className="ov-label">Keywords</div>}
      <ul className="ov-cues">
        {card.cues.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
      {notes.map((n, i) => (
        <div key={i} className="ov-note">
          {n}
        </div>
      ))}
    </div>
  );
}
